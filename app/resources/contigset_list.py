import tempfile
import os
import uuid
from itertools import product

import werkzeug
from flask import session, abort
from flask.ext.restful import Resource, reqparse

from app import db, utils, app, q
from app.models import Coverage, Contig, Contigset


def save_contigs(contigset, fasta_filename, calculate_fourmers, bulk_size=5000):
    """
    :param contigset: A Contigset model object in which to save the contigs.
    :param fasta_filename: The file name of the fasta file where the contigs are stored.
    :param bulk_size: How many contigs to store per bulk.
    """
    fourmers = [''.join(fourmer) for fourmer in product('atcg', repeat=4)]
    for i, data in enumerate(utils.parse_fasta(fasta_filename), 1):
        name, sequence = data
        sequence = sequence.lower()
        contig = Contig(name=name, sequence=sequence, length=len(sequence),
                        gc=utils.gc_content(sequence), contigset=contigset)
        if calculate_fourmers:
            fourmer_count = len(sequence) - 4 + 1
            frequencies = ','.join(str(sequence.count(fourmer) / fourmer_count)
                                   for fourmer in fourmers)
            contig.fourmerfreqs = frequencies
        db.session.add(contig)
        if i % bulk_size == 0:
            app.logger.debug('At: ' + str(i))
            db.session.flush()
    db.session.commit()
    os.remove(fasta_filename)
    contigs = {contig.name: contig.id for contig in contigset.contigs}
    return contigs


def save_coverages(contigs, coverage_filename):
    """
    :param contigs: A dict contig_name -> contig_id.
    :param coverage_filename: The name of the dsv file.
    """
    coverage_file = utils.parse_dsv(coverage_filename)

    # Determine if the file has a header.
    fields = next(coverage_file)
    has_header = not utils.is_number(fields[1])

    def add_coverages(contig_name, _coverages):
        try:
            contig_id = contigs.pop(contig_name)
        except KeyError:
            return
        for i, cov in enumerate(_coverages):
            db.session.add(Coverage(value=cov, name=header[i], contig_id=contig_id))

    header = fields[1:]
    if not has_header:
        header = ['cov_{}'.format(i) for i, _ in enumerate(fields[1:], 1)]
        contig_name, *_coverages = fields
        add_coverages(contig_name, _coverages)

    for contig_name, *_coverages in coverage_file:
        add_coverages(contig_name, _coverages)

    db.session.commit()
    os.remove(coverage_filename)


def save_contigset_job(contigset, fasta_filename, calculate_fourmers, 
                       coverage_filename=None, bulk_size=5000):
    contigs = save_contigs(contigset, fasta_filename, calculate_fourmers, bulk_size)
    if coverage_filename is not None:
        save_coverages(contigs, coverage_filename)
    return contigset.id


class ContigsetListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, default='contigset',
                                   location='form')
        self.reqparse.add_argument('fourmers', type=bool, default=False,
                                   location='form')
        self.reqparse.add_argument('contigs', location='files',
                                   type=werkzeug.datastructures.FileStorage)
        self.reqparse.add_argument('coverage', location='files',
                                   type=werkzeug.datastructures.FileStorage)
        super(ContigsetListApi, self).__init__()

    def get(self):
        userid = session.get('uid')
        if userid is None:
            abort(404)
        result = []
        for contigset in Contigset.query.filter_by(userid=userid).all():
            result.append({'name': contigset.name, 'id': contigset.id,
                           'size': contigset.contigs.count(),
                           'binsets': [binset.id for binset in contigset.binsets],
                           'samples': contigset.samples})
        return {'contigsets': result}

    def post(self):
        args = self.reqparse.parse_args()

        contigset = Contigset(name=args.name, userid=session['uid'])
        db.session.add(contigset)
        db.session.commit()
        
        if args.contigs:
            fasta_file = tempfile.NamedTemporaryFile(delete=False)
            args.contigs.save(fasta_file)
            fasta_file.close()
            if args.coverage:
                coverage_file = tempfile.NamedTemporaryFile(delete=False)
                args.coverage.save(coverage_file)
                coverage_file.close()
            # Send job
            job_id = 'ctg-{}'.format(uuid.uuid4()) 
            job_args = [contigset, fasta_file.name, args.fourmers]
            job_meta = {'name': contigset.name, 'id': contigset.id}
            if args.coverage:
                job_args.append(coverage_file.name)
            job = q.enqueue(save_contigset_job, args=job_args, job_id=job_id,
                            meta=job_meta, timeout=5*60)

        return {'id': job_id, 'meta': job_meta}

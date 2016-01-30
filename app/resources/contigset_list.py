import tempfile
import os

import werkzeug
from flask import session, abort
from flask.ext.restful import Resource, reqparse

from app import db, utils
from app.models import Coverage, Contig, Contigset


def save_contigs(contigset, fasta_filename, coverage_objects=None, bulk_size=5000):
    """
    :param contigset: A Contigset model object in which to save the contigs.
    :param fasta_filename: The file name of the fasta file where the contigs are stored.
    :param coverage_objects: A dict with keys contig names and values Coverage objects.
    :param bulk_size: How many contigs to store per bulk.
    """
    for i, data in enumerate(utils.parse_fasta(fasta_filename), 1):
        name, sequence = data
        coverages = coverage_objects.get(name, []) if coverage_objects else []
        db.session.add(Contig(name=name, sequence=sequence, length=len(sequence),
                              gc=utils.gc_content(sequence), contigset=contigset, coverages=coverages))
        if i % bulk_size == 0:
            db.session.flush()
    db.session.commit()


def create_coverage_objects(coverage_filename):
    """
    :param coverage_filename: The name of the dsv file.
    """
    coverage_file = utils.parse_dsv(coverage_filename)
    coverages = {} # contig_name -> list of Coverage objects

    # Determine if the file has a header.
    fields = next(coverage_file)
    has_header = not utils.is_number(fields[1])

    header = fields[1:]
    if not has_header:
        header = ['cov_{}'.format(i) for i, _ in enumerate(fields[1:], 1)]
        contig_name, *_coverages = fields
        coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                  for i, cov in enumerate(_coverages)]

    for contig_name, *_coverages in coverage_file:
        coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                  for i, cov in enumerate(_coverages)]

    return coverages


class ContigsetListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, default='contigset',
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
                coverage_objects = create_coverage_objects(coverage_file.name)
                os.remove(coverage_file.name)
                save_contigs(contigset, fasta_file.name,
                             coverage_objects=coverage_objects)
            else:
                save_contigs(contigset, fasta_file.name)
            os.remove(fasta_file.name)

        return {'id': contigset.id, 'name': contigset.name, 'binsets': [],
                'size': contigset.contigs.count(), 'samples': contigset.samples}

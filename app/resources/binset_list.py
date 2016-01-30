import tempfile
import os

import werkzeug
from flask.ext.restful import Resource, reqparse

from .utils import user_contigset_or_404
from app import db, utils, randomcolor
from app.models import Contig, Bin, Binset


class BinsetListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, default='binset',
                                   location='form')
        self.reqparse.add_argument('bins', required=True,
                                   type=werkzeug.datastructures.FileStorage, location='files')
        self.randcol = randomcolor.RandomColor()
        super(BinsetListApi, self).__init__()

    def get(self, contigset_id):
        contigset = user_contigset_or_404(contigset_id)
        result = []
        for binset in contigset.binsets:
            result.append({
                'name': binset.name, 'id': binset.id, 'contigset': contigset.id,
                'color': binset.color, 'bins': [bin.id for bin in binset.bins]})
        return {'binsets': result}

    def post(self, contigset_id):
        contigset = user_contigset_or_404(contigset_id)
        args = self.reqparse.parse_args()

        bin_file = tempfile.NamedTemporaryFile(delete=False)
        args.bins.save(bin_file)
        bin_file.close()

        # Dict: contig -> bin
        contig_bins = {}
        for contig_name, bin_name in utils.parse_dsv(bin_file.name):
            contig_bins[contig_name] = bin_name

        contigs = [contig for contig in contigset.contigs if contig.name in contig_bins]

        # Bins can contain contig names which are not present in the contigset.
        # Add these new contigs to the contigset.
        new_contigs = []
        contig_names = [contig.name for contig in contigs]
        for contig_name in [c for c in contig_bins if c not in contig_names]:
            new_contigs.append(Contig(name=contig_name))
        contigset.contigs.extend(new_contigs)

        done = {}
        for contig in contigs:
            bin_name = contig_bins[contig.name]
            bin = done.get(bin_name)
            if bin is None:
                bin = Bin(name=bin_name, color=self.randcol.generate()[0])
                done[bin_name] = bin
            bin.contigs.append(contig)

        binset = Binset(name=args.name, color=self.randcol.generate()[0],
                        bins=list(done.values()), contigset=contigset)

        os.remove(bin_file.name)
        db.session.add(binset)
        db.session.commit()
        return {'id': binset.id, 'name': binset.name, 'color': binset.color,
                'bins': [bin.id for bin in binset.bins], 'contigset': contigset.id}

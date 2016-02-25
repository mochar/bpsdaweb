import tempfile
import os
from collections import defaultdict

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

        # Dict: bin -> contigs
        bins = defaultdict(list)
        for contig_name, bin_name in utils.parse_dsv(bin_file.name):
            bins[bin_name].append(contig_name)

        bin_objects = []
        contigs = {c.name: c for c in contigset.contigs}
        for bin_name, bin_contigs in bins.items():
            bin_contigs = [contigs.pop(c) for c in bin_contigs]
            bin = Bin(name=bin_name, color=self.randcol.generate()[0],
                      contigs=bin_contigs)
            bin_objects.append(bin)

        # Create a bin for the unbinned contigs.
        bin = Bin(name='unbinned', color='#939393',
                  contigs=list(contigs.values()))
        bin_objects.append(bin)

        binset = Binset(name=args.name, color=self.randcol.generate()[0],
                        bins=bin_objects, contigset=contigset)

        os.remove(bin_file.name)
        db.session.add(binset)
        db.session.commit()
        return {'id': binset.id, 'name': binset.name, 'color': binset.color,
                'bins': [bin.id for bin in binset.bins], 'contigset': contigset.id}

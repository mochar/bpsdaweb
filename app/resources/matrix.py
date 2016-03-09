import collections

from flask.ext.restful import Resource, reqparse

from .utils import binset_or_404
from app import db
from app.models import bincontig


class MatrixApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('binset1', type=int, required=True)
        self.reqparse.add_argument('binset2', type=int, required=True)

    def _create_matrix(self, bins1, bins2):
        matrix = []
        for bin1, contigs1 in bins1:
            matching = [0] * len(bins1)
            for bin2, contigs2 in bins2:
                matching.append(len([c for c in contigs1 if c in contigs2]))
            matrix.append(matching)
        for bin2, contigs2 in bins2:
            matching = []
            for bin1, contigs1 in bins1:
                matching.append(len([c for c in contigs2 if c in contigs1]))
            matching.extend([0] * len(bins2))
            matrix.append(matching)
        return matrix

    def get(self, contigset_id):
        args = self.reqparse.parse_args()

        binset1 = binset_or_404(contigset_id, args.binset1)
        binset2 = binset_or_404(contigset_id, args.binset2)
        # bins1 = [bin.id for bin in sorted(binset1.bins.options(db.load_only('id')).all(), key=lambda x: x.gc)]
        # bins2 = [bin.id for bin in sorted(binset2.bins.options(db.load_only('id')).all(), key=lambda x: x.gc, reverse=True)]
        bins1 = [bin.id for bin in sorted(binset1.without_unbinned.all(), key=lambda x: x.gc)]
        bins2 = [bin.id for bin in sorted(binset2.without_unbinned.all(), key=lambda x: x.gc, reverse=True)]
        all_bins = bins1 + bins2

        data = db.session.query(bincontig). \
            filter(bincontig.c.bin_id.in_(all_bins)). \
            order_by('bin_id'). \
            all()
        bins = collections.defaultdict(list)
        for bin, contig in data:
            bins[bin].append(contig)

        bins11 = [(bin, bins[bin]) for bin in bins1]
        bins22 = [(bin, bins[bin]) for bin in bins2]
        matrix = self._create_matrix(bins11, bins22)
        return {'matrix': matrix, 'bins1': bins1, 'bins2': bins2}


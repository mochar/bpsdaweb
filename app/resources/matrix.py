import collections

from flask.ext.restful import Resource, reqparse

from .utils import binset_or_404
from app import db, utils
from app.models import bincontig


class MatrixApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('binset1', type=int, required=True)
        self.reqparse.add_argument('binset2', type=int, required=True)

    def get(self, contigset_id):
        args = self.reqparse.parse_args()

        # contigset = user_contigset_or_404(contigset_id)
        # ids = [x[0] for x in contigset.contigs.with_entities(Contig.id).all()]

        binset1 = binset_or_404(contigset_id, args.binset1)
        binset2 = binset_or_404(contigset_id, args.binset2)
        bins1 = [bin.id for bin in sorted(binset1.bins.options(db.load_only('id')).all(), key=lambda x: x.gc)]
        bins2 = [bin.id for bin in sorted(binset2.bins.options(db.load_only('id')).all(), key=lambda x: x.gc, reverse=True)]
        bins = bins1 + bins2

        data = db.session.query(bincontig). \
            filter(bincontig.c.bin_id.in_(bins)). \
            order_by('bin_id'). \
            all()
        bins = collections.defaultdict(list)
        for bin, contig in data:
            bins[bin].append(contig)

        matrix = utils.to_matrix(bins)
        return {'matrix': matrix, 'bins1': bins1, 'bins2': bins2}

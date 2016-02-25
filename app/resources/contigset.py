from flask.ext.restful import Resource, reqparse

from .utils import user_contigset_or_404
from app import db


class ContigsetApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str)
        super(ContigsetApi, self).__init__()

    def get(self, id):
        contigset = user_contigset_or_404(id)
        return {
            'id': contigset.id,
            'name': contigset.name,
            'size': contigset.contigs.count(),
            'samples': contigset.samples,
            'binsets': [binset.id for binset in contigset.binsets]
        }

    def put(self, id):
        args = self.reqparse.parse_args()
        contigset = user_contigset_or_404(id)
        if args.name is not None:
            contigset.name = args.name
        db.session.commit()

    def delete(self, id):
        contigset = user_contigset_or_404(id)
        db.session.delete(contigset)
        db.session.commit()

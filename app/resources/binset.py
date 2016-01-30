from flask.ext.restful import Resource, reqparse

from .utils import binset_or_404
from app import db


class BinsetApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str)
        super(BinsetApi, self).__init__()

    def get(self, contigset_id, id):
        binset = binset_or_404(contigset_id, id)
        return {
            'id': binset.id, 'name': binset.name, 'color': binset.color,
            'bins': [bin.id for bin in binset.bins],
            'contigset': binset.contigset.id
        }

    def put(self, contigset_id, id):
        args = self.reqparse.parse_args()
        binset = binset_or_404(contigset_id, id)
        if args.name is not None:
            binset.name = args.name
        db.session.commit()

    def delete(self, contigset_id, id):
        binset = binset_or_404(contigset_id, id)
        db.session.delete(binset)
        db.session.commit()

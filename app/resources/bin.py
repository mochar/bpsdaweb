from flask.ext.restful import Resource, reqparse

from .utils import bin_or_404
from app import db, app
from app.models import Contig


class BinApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, location='form')
        self.reqparse.add_argument('color', type=str, location='form')
        self.reqparse.add_argument('contigs', type=str, location='form')
        self.reqparse.add_argument('action', type=str, location='form',
                                   choices=['add', 'remove'])
        self.reqparse.add_argument('fields', type=str,
                                    default='id,name,color,binset_id,size,gc,'
                                            'N50,contigs')

    def get(self, contigset_id, binset_id, id):
        args = self.reqparse.parse_args()
        bin = bin_or_404(contigset_id, binset_id, id)
        result = {}
        for field in args.fields.split(','):
            if field == 'contigs':
                result['contigs'] = [contig.id for contig in bin.contigs]
            else:
                result[field] = getattr(bin, field)
        return result

    def put(self, contigset_id, binset_id, id):
        args = self.reqparse.parse_args()
        bin = bin_or_404(contigset_id, binset_id, id)

        if args.contigs:
            contig_ids = [int(id) for id in args.contigs.split(',')]
            if args.action == 'add':
                contigs = bin.binset.contigset.contigs. \
                    filter(Contig.id.in_(contig_ids)). \
                    all()
                bin.contigs.extend(contigs)
            elif args.action == 'remove':
                bin.contigs = [c for c in bin.contigs if c.id not in contig_ids]
            else:
                contigs = bin.binset.contigset.contigs. \
                    filter(Contig.id.in_(contig_ids)). \
                    all()
                bin.contigs = contigs
        if args.name is not None:
            bin.name = args.name
        db.session.commit()
        return {field: getattr(bin, field) for field in
                'id,name,color,binset_id,size,gc,N50'.split(',')}

    def delete(self, contigset_id, binset_id, id):
        bin = bin_or_404(contigset_id, binset_id, id)
        db.session.delete(bin)
        db.session.commit()

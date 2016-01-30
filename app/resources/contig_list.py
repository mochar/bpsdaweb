from flask.ext.restful import Resource, reqparse, inputs

from .utils import user_contigset_or_404
from app import db
from app.models import Contig, Bin


class ContigListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('items', type=int, default=50, dest='_items')
        self.reqparse.add_argument('index', type=int, default=1)
        self.reqparse.add_argument('sort', type=str, choices=[
            'id', 'name', 'gc', 'length', '-id', '-name', '-gc', '-length'])
        self.reqparse.add_argument('fields', type=str,
                                   default='id,name,length,gc,contigset_id')
        self.reqparse.add_argument('length', type=str)
        self.reqparse.add_argument('bins', type=str)
        self.reqparse.add_argument('coverages', type=inputs.boolean)
        super(ContigListApi, self).__init__()

    def get(self, contigset_id):
        args = self.reqparse.parse_args()
        contigs = user_contigset_or_404(contigset_id).contigs
        if args.fields:
            fields = args.fields.split(',')
            contigs = contigs.options(db.load_only(*fields))
        if args.sort:
            order = db.desc(args.sort[1:]) if args.sort[0] == '-' else db.asc(args.sort)
            contigs = contigs.order_by(order)
        if args.length:
            length = args.length.rstrip('-').rstrip('+')
            if not length.isnumeric():
                return
            length = int(length)
            if args.length.endswith('-'):
                filter = Contig.length < length
            elif args.length.endswith('+'):
                filter = Contig.length > length
            else:
                filter = Contig.length == length
            contigs = contigs.filter(filter)
        if args.bins:
            bin_ids = args.bins.split(',')
            contigs = contigs.join((Bin, Contig.bins)).filter(Bin.id.in_(bin_ids))
        if args.coverages:
            contigs = contigs.options(db.joinedload('coverages'))
        contig_pagination = contigs.paginate(args.index, args._items, False)
        result = []
        for contig in contig_pagination.items:
            r = {}
            if args.fields:
                for field in fields:
                    r[field] = getattr(contig, field)
            if args.coverages:
                for cov in contig.coverages:
                    r[cov.name] = cov.value
            result.append(r)

        return {'contigs': result, 'indices': contig_pagination.pages,
                'index': args.index, 'count': contigs.count(), 'items': args._items}


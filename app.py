import uuid
import json

import werkzeug
from flask import Flask, render_template, g, session, abort, request
from flask.ext.sqlalchemy import SQLAlchemy
from flask_restful import Api, Resource, reqparse
from sqlalchemy.sql import func

import utils
import randomcolor


app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)
api = Api(app)
randcol = randomcolor.RandomColor()


''' Database '''
bincontig = db.Table('bincontig',
    db.Column('bin_id', db.Integer, db.ForeignKey('bin.id')),
    db.Column('contig_id', db.Integer, db.ForeignKey('contig.id'))
)


class Bin(db.Model):
    __tablename__ = 'bin'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(25))
    binset_id = db.Column(db.Integer, db.ForeignKey('binset.id'),
        nullable=False)
    color = db.Column(db.String(7), default='#ffffff')
    contigs = db.relationship('Contig', secondary=bincontig,
        backref=db.backref('bins', lazy='dynamic'))


class Contig(db.Model):
    __tablename__ = 'contig'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    sequence = db.Column(db.String)
    length = db.Column(db.String)
    gc = db.Column(db.Integer)
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'),
         nullable=False)
    coverages = db.relationship('Coverage', backref='contig', lazy='dynamic',
        cascade='all, delete')


class Coverage(db.Model):
    __tablename__ = 'coverage'
    id = db.Column(db.Integer, primary_key=True)
    contig_id = db.Column(db.Integer, db.ForeignKey('contig.id'), nullable=False)
    name = db.Column(db.String(60))
    value = db.Column(db.Integer)


class Binset(db.Model):
    __tablename__ = 'binset'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    color = db.Column(db.String(7))
    bins = db.relationship('Bin', backref='binset', lazy='dynamic',
        cascade='all, delete')
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'),
         nullable=False)


class Contigset(db.Model):
    __tablename__ = 'contigset'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    userid = db.Column(db.String)
    contigs = db.relationship('Contig', backref='contigset', lazy='dynamic',
        cascade='all, delete')
    binsets = db.relationship('Binset', backref='contigset', lazy='dynamic',
        cascade='all, delete')


''' API '''
def user_contigset_or_404(id):
    userid = session.get('uid')
    if userid is None:
        abort(404)
    contigset = Contigset.query.filter_by(userid=userid, id=id).first()
    if contigset is None:
        abort(404)
    return contigset


def binset_or_404(contigset_id, id):
    contigset = user_contigset_or_404(contigset_id)
    binset = contigset.binsets.filter_by(id=id).first()
    if binset is None:
        abort(404)
    return binset


def bin_or_404(contigset_id, binset_id, id):
    binset = binset_or_404(contigset_id, binset_id)
    bin = binset.bins.filter_by(id=id).first()
    if bin is None:
        abort(404)
    return bin


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
                           'length': contigset.contigs.count(),
                           'binsets': [binset.id for binset in contigset.binsets]})
        return {'contigsets': result}

    def post(self):
        args = self.reqparse.parse_args()

        coverages = {}
        if args.coverage:
            coverage_file = utils.parse_dsv(args.coverage.stream)
            fields = next(coverage_file)
            if utils.is_number(fields[1]):
                header = ['cov_{}'.format(i) for i, _ in enumerate(fields[1:], 1)]
                contig_name, *_coverages = fields
                coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                          for i, cov in enumerate(_coverages)]
            else:
                header = fields[1:]
            for contig_name, *_coverages in coverage_file:
                coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                          for i, cov in enumerate(_coverages)]

        contigs = []
        if args.contigs:
            for header, sequence in utils.parse_fasta(args.contigs.stream):
                contig_coverage = coverages.get(header,
                    [Coverage(value=0, name=x) for x in header])
                contigs.append(Contig(name=header, sequence=sequence,
                    gc=utils.gc_content(sequence), coverages=contig_coverage,
                    length=len(sequence)))

        contigset = Contigset(name=args.name, userid=session['uid'],
            contigs=contigs)

        db.session.add(contigset)
        db.session.commit()

        return {'id': contigset.id, 'name': args.name, 'length': len(contigs),
            'binsets': []}


class ContigsetApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str)
        super(ContigsetApi, self).__init__()

    def get(self, id):
        contigset = user_contigset_or_404(id)
        return {
            'name': contigset.name,
            'contigs': [c.id for c in contigset.contigs],
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


class ContigListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('items', type=int, default=50, dest='_items')
        self.reqparse.add_argument('index', type=int, default=1)
        self.reqparse.add_argument('sort', type=str, default='name',
            choices=['id', 'name', 'gc', 'length',
                     '-id', '-name', '-gc', '-length'])
        self.reqparse.add_argument('fields', type=str,
            default=['id', 'name', 'gc', 'length', 'coverages'])
        self.reqparse.add_argument('length', type=str)
        super(ContigListApi, self).__init__()

    def get(self, contigset_id):
        args = self.reqparse.parse_args()
        contigset = user_contigset_or_404(contigset_id)
        order = db.desc(args.sort[1:]) if args.sort[0] == '-' else db.asc(args.sort)
        contigs = contigset.contigs.order_by(order)
        if args.length and args.length.rstrip('-').rstrip('+').isnumeric():
            if args.length.endswith('-'):
                filter = Contig.length < int(args.length.rstrip('-'))
            elif args.length.endswith('+'):
                filter = Contig.length > int(args.length.rstrip('+'))
            else:
                filter = Contig.length == int(args.length)
            contigs = contigs.filter(filter)
        contigs = contigs.paginate(args.index, args._items, False)
        result = []
        for contig in contigs.items:
            gc = contig.gc if contig.gc is not None else '-'
            length = len(contig.sequence) if contig.sequence is not None else '-'
            coverages = {cov.name: cov.value for cov in contig.coverages.all()}
            r = {}
            if 'id' in args.fields: r['id'] = contig.id
            if 'name' in args.fields: r['name'] = contig.name
            if 'gc' in args.fields: r['gc'] = gc
            if 'length' in args.fields: r['length'] = length
            if 'coverages' in args.fields: r['coverages'] = coverages
            result.append(r)

        return {'contigs': result, 'indices': contigs.pages, 'index': args.index,
            'count': contigset.contigs.count(), 'items': args._items}


class ContigApi(Resource):
    def get(self, contigset_id, id):
        contigset = user_contigset_or_404(contigset_id)
        contig = contigset.contigs.filter_by(id=id).first()
        if contig is None:
            abort(404)
        return {
            'name': contig.name,
            'id': contig.id,
            'sequence': contig.sequence
        }


class BinsetListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, default='binset',
            location='form')
        self.reqparse.add_argument('bins', required=True,
           type=werkzeug.datastructures.FileStorage, location='files')
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

        # Dict: contig -> bin
        contig_bins = {}
        for contig_name, bin_name in utils.parse_dsv(args.bins):
            contig_bins[contig_name] = bin_name

        filter = Contig.name.in_(contig_bins)
        contigs = contigset.contigs.filter(filter).all()

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
                bin = Bin(name=bin_name, color=randcol.generate()[0])
                done[bin_name] = bin
            bin.contigs.append(contig)

        binset = Binset(name=args.name, color=randcol.generate()[0],
            bins=list(done.values()), contigset=contigset)

        db.session.add(binset)
        db.session.commit()
        return {'id': binset.id, 'name': binset.name, 'color': binset.color,
            'bins': [bin.id for bin in binset.bins], 'contigset': contigset.id}


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


class BinListApi(Resource):
    def get(self, contigset_id, id):
        binset = binset_or_404(contigset_id, id)
        result = []
        for bin in binset.bins:
            result.append({'name': bin.name, 'id': bin.id, 'color': bin.color,
                'binset': binset.id, 'contigs': [c.id for c in bin.contigs]})
        return {'bins': result}


class BinApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('name', type=str, location='form')
        self.reqparse.add_argument('color', type=str, location='form')

    def get(self, contigset_id, binset_id, id):
        bin = bin_or_404(contigset_id, binset_id, id)
        return {
            'id': bin.id, 'name': bin.name, 'color': bin.color,
            'binset': bin.binset_id, 'contigs': [c.id for c in bin.contigs]
        }

    def put(self, contigset_id, binset_id, id):
        args = self.reqparse.parse_args()
        bin = bin_or_404(contigset_id, binset_id, id)
        if args.name is not None:
            bin.name = args.name
        db.session.commit()

    def delete(self, contigset_id, binset_id, id):
        bin = bin_or_404(contigset_id, binset_id, id)
        db.session.delete(bin)
        db.session.commit()


api.add_resource(ContigsetListApi, '/contigsets')
api.add_resource(ContigsetApi, '/contigsets/<int:id>')
api.add_resource(ContigListApi, '/contigsets/<int:contigset_id>/contigs')
api.add_resource(ContigApi, '/contigsets/<int:contigset_id>/contigs/<int:id>')
api.add_resource(BinsetListApi, '/contigsets/<int:contigset_id>/binsets')
api.add_resource(BinsetApi, '/contigsets/<int:contigset_id>/binsets/<int:id>')
api.add_resource(BinListApi, '/contigsets/<int:contigset_id>/binsets/<int:id>/bins')
api.add_resource(BinApi, '/contigsets/<int:contigset_id>/binsets/'
                             '<int:binset_id>/bins/<int:id>')


''' Views '''
@app.before_request
def make_session_permanent():
    session.permanent = True


@app.route('/to_matrix')
def to_matrix():
    userid = session.get('uid')
    if userid is None:
        abort(404)
    bins = request.args.get('bins')
    if bins is None:
        abort(400)
    bins = Bin.query.filter(Bin.id.in_(bins.split(','))).all()
    return json.dumps(utils.to_matrix(bins))


@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)


if __name__ == '__main__':
    app.run(debug=True)

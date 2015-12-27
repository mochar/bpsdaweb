import uuid
import json

import werkzeug
from flask import Flask, render_template, g, session, abort, request
from flask.ext.sqlalchemy import SQLAlchemy
from flask_restful import Api, Resource, reqparse

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
    binset_id = db.Column(db.Integer, db.ForeignKey('binset.id'))
    color = db.Column(db.String(7), default='#ffffff')
    contigs = db.relationship('Contig', secondary=bincontig,
        backref=db.backref('bins', lazy='dynamic'))


class Contig(db.Model):
    __tablename__ = 'contig'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    sequence = db.Column(db.String)
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'))


class Binset(db.Model):
    __tablename__ = 'binset'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    color = db.Column(db.String(7))
    bins = db.relationship('Bin', backref='binset', lazy='dynamic',
        cascade='all, delete')
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'))


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

        contigs = []
        if args.contigs:
            for header, sequence in utils.parse_fasta(args.contigs.stream):
                contigs.append(Contig(name=header, sequence=sequence))

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
        self.reqparse.add_argument('_items', type=int, default=50)
        self.reqparse.add_argument('index', type=int, default=1)
        super(ContigListApi, self).__init__()

    def get(self, contigset_id):
        args = self.reqparse.parse_args()
        contigset = user_contigset_or_404(contigset_id)
        contigs = contigset.contigs.paginate(args.index, args._items, False).items
        result = []
        for contig in contigs:
            gc = utils.gc_content(contig.sequence) if contig.sequence else '-'
            length = len(contig.sequence) if contig.sequence else '-'
            result.append({'id': contig.id, 'name': contig.name, 'gc': gc,
                'length': length})
        return {'contigs': result}


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
        contig_names = [contig.name for contig in contigs]
        for contig_name in [c for c in contig_bins if c not in contig_names]:
            contigs.append(Contig(name=contig_name))
        contigset.contigs = contigs

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
        self.reqparse.add_argument('name', type=str, location='form')
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

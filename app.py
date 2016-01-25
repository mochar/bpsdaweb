import uuid
import json
import tempfile
import os
import time

import werkzeug
from flask import Flask, render_template, g, session, abort, request, jsonify
from flask.ext.sqlalchemy import SQLAlchemy
from flask_restful import Api, Resource, reqparse, inputs

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

    @property
    def gc(self):
        return utils.gc_content_bin(self)

    @property
    def size(self):
        return len(self.contigs)

    @property
    def N50(self):
        return utils.n50(self)


class Contig(db.Model):
    __tablename__ = 'contig'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    sequence = db.Column(db.String)
    length = db.Column(db.Integer)
    gc = db.Column(db.Integer)
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'),
         nullable=False)
    coverages = db.relationship('Coverage', backref='contig',
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

    @property
    def samples(self):
        samples = Coverage.query.join(Coverage.contig) \
            .filter(Contig.contigset == self) \
            .with_entities(Coverage.name) \
            .distinct() \
            .all()
        return [sample[0] for sample in samples]


def save_contigs(contigset, fasta_filename, coverage_objects=None, bulk_size=5000):
    """
    :param contigset: A Contigset model object in which to save the contigs.
    :param fasta_filename: The file name of the fasta file where the contigs are stored.
    :param coverage_objects: A dict with keys contig names and values Coverage objects.
    :param bulk_size: How many contigs to store per bulk.
    """
    for i, data in enumerate(utils.parse_fasta(fasta_filename), 1):
        name, sequence = data
        coverages = coverage_objects.get(name, []) if coverage_objects else []
        db.session.add(Contig(name=name, sequence=sequence, length=len(sequence),
            gc=utils.gc_content(sequence), contigset=contigset, coverages=coverages))
        if i % bulk_size == 0:
            db.session.flush()
    db.session.commit()


def create_coverage_objects(coverage_filename):
    """
    :param coverage_filename: The name of the dsv file.
    """
    coverage_file = utils.parse_dsv(coverage_filename)
    coverages = {} # contig_name -> list of Coverage objects

    # Determine if the file has a header.
    fields = next(coverage_file)
    has_header = not utils.is_number(fields[1])

    header = fields[1:]
    if not has_header:
        header = ['cov_{}'.format(i) for i, _ in enumerate(fields[1:], 1)]
        contig_name, *_coverages = fields
        coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                  for i, cov in enumerate(_coverages)]

    for contig_name, *_coverages in coverage_file:
        coverages[contig_name] = [Coverage(value=cov, name=header[i])
                                  for i, cov in enumerate(_coverages)]

    return coverages


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
                           'size': contigset.contigs.count(),
                           'binsets': [binset.id for binset in contigset.binsets],
                           'samples': contigset.samples})
        return {'contigsets': result}

    def post(self):
        args = self.reqparse.parse_args()

        contigset = Contigset(name=args.name, userid=session['uid'])
        db.session.add(contigset)
        db.session.commit()

        if args.contigs:
            fasta_file = tempfile.NamedTemporaryFile(delete=False)
            args.contigs.save(fasta_file)
            fasta_file.close()
            if args.coverage:
                coverage_file = tempfile.NamedTemporaryFile(delete=False)
                args.coverage.save(coverage_file)
                coverage_file.close()
                coverage_objects = create_coverage_objects(coverage_file.name)
                os.remove(coverage_file.name)
                save_contigs(contigset, fasta_file.name,
                    coverage_objects=coverage_objects)
            else:
                save_contigs(contigset, fasta_file.name)
            os.remove(fasta_file.name)

        return {'id': contigset.id, 'name': contigset.name, 'binsets': [],
            'size': contigset.contigs.count(), 'samples': contigset.samples}


api.add_resource(ContigsetListApi, '/contigsets')


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


api.add_resource(ContigsetApi, '/contigsets/<int:id>')


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


api.add_resource(ContigListApi, '/contigsets/<int:contigset_id>/contigs')


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


api.add_resource(ContigApi, '/contigsets/<int:contigset_id>/contigs/<int:id>')


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
                bin = Bin(name=bin_name, color=randcol.generate()[0])
                done[bin_name] = bin
            bin.contigs.append(contig)

        binset = Binset(name=args.name, color=randcol.generate()[0],
            bins=list(done.values()), contigset=contigset)

        os.remove(bin_file.name)
        db.session.add(binset)
        db.session.commit()
        return {'id': binset.id, 'name': binset.name, 'color': binset.color,
            'bins': [bin.id for bin in binset.bins], 'contigset': contigset.id}


api.add_resource(BinsetListApi, '/contigsets/<int:contigset_id>/binsets')


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


api.add_resource(BinsetApi, '/contigsets/<int:contigset_id>/binsets/<int:id>')


class BinListApi(Resource):
    def __init__(self):
        self.reqparse = reqparse.RequestParser()
        self.reqparse.add_argument('ids', type=str)
        self.reqparse.add_argument('contigs', type=bool)
        self.reqparse.add_argument('fields', type=str,
           default='id,name,color,binset_id,size,gc,N50')
        super(BinListApi, self).__init__()

    def get(self, contigset_id, id):
        binset = binset_or_404(contigset_id, id)
        args =  self.reqparse.parse_args()
        result = []
        for bin in binset.bins:
            r = {}
            for field in args.fields.split(','):
                r[field] = getattr(bin, field)
            if args.contigs:
                r['contigs'] = [contig.id for contig in bin.contigs]
            result.append(r)
        return {'bins': result}

    def delete(self, contigset_id, id):
        binset = binset_or_404(contigset_id, id)
        args =  self.reqparse.parse_args()
        if args.ids is None:
            abort(400)
        ids = [int(id) for id in args.ids.split(',')]
        binset.bins.filter(Bin.id.in_(ids)).delete(synchronize_session='fetch')
        db.session.commit()


api.add_resource(BinListApi, '/contigsets/<int:contigset_id>/binsets/<int:id>/bins')


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
    matrix = utils.to_matrix(bins)
    return json.dumps(matrix)


@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)


if __name__ == '__main__':
    app.run()

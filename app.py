from collections import defaultdict
import uuid
import json

from flask import Flask, render_template, g, session, abort, jsonify
from flask.ext.sqlalchemy import SQLAlchemy
import flask_sijax

import utils
import randomcolor


app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)
flask_sijax.Sijax(app)
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
    header = db.Column(db.String(120))
    sequence = db.Column(db.String)
    contigset_id = db.Column(db.Integer, db.ForeignKey('contigset.id'))

class Binset(db.Model):
    __tablename__ = 'binset'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    userid = db.Column(db.String)
    color = db.Column(db.String(7))
    bins = db.relationship('Bin', backref='binset', lazy='dynamic')

class Contigset(db.Model):
    __tablename__ = 'contigset'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    userid = db.Column(db.String)
    contigs = db.relationship('Contig', backref='contigset', lazy='dynamic')


''' Sijax '''
class SijaxHandler(object):
    @staticmethod
    def _add_alert(obj_response, div, text):
        obj_response.html(div, """
        <div class="alert alert-warning alert-dismissible" role="alert">
            <button type="button" class="close" data-dismiss="alert"
                    aria-label="Close"><span aria-hidden="true">&times;</span>
            </button>
            {}
        </div>
        """.format(text))

    @staticmethod
    def contigset_form_handler(obj_response, files, form_values):
        # Clean form
        obj_response.reset_form()

        # Validate input
        contig_file = files.get('contigsetFile')
        contigset_name = form_values.get('contigsetName')[0]
        if '' in (contig_file.filename, contigset_name):
            SijaxHandler._add_alert(obj_response, '#contigsetAlerts',
                                    'Onjuiste input.')
            return

        contigset = Contigset.query.filter_by(name=contigset_name,
                                              userid=session['uid']).first()
        if contigset is not None:
            SijaxHandler._add_alert(obj_response, '#contigsetAlerts',
                                    'Contigs zijn al geupload.')
            return

        # Create new contigset
        contigset = Contigset(name=contigset_name, userid=session['uid'])
        db.session.add(contigset)
        db.session.commit()

        # Add data to database
        contigs = []
        for header, sequence in utils.parse_fasta(contig_file.stream):
            contigs.append(Contig(header=header, sequence=sequence,
                                  contigset_id=contigset.id))
        db.session.add_all(contigs)
        db.session.commit()

        obj_response.html_append('#contigsetList',
            '<li class="list-group-item">'
            '<span class="badge">{}</span>'
            '{}</li>'.format(len(contigs), contigset_name))
        obj_response.html_prepend('#binsetContigset',
            '<option>{}</option>'.format(contigset_name))
        obj_response.call('$("#binsetContigset").prop("selectedIndex", 0)')

    @staticmethod
    def binset_form_handler(obj_response, files, form_values):
        # Clean form
        obj_response.reset_form()
        obj_response.remove('#binTable > tbody > tr')

        # Validate input
        bin_file = files.get('binsetFile')
        binset_name = form_values.get('binsetName')[0]
        contigset_name = form_values.get('binsetContigset')[0]
        if '' in (bin_file.filename, binset_name):
            SijaxHandler._add_alert(obj_response, '#binsetAlerts',
                                    'Onjuiste input.')
            return

        binset = Binset.query.filter_by(name=binset_name,
                                        userid=session['uid']).first()
        if binset is not None: # Bins already uploaded
            SijaxHandler._add_alert(obj_response, '#binsetAlerts',
                                    'Bins zijn al geupload.')
            return

        # Create new binset
        binset = Binset(name=binset_name, userid=session['uid'],
                        color=randcol.generate()[0])
        db.session.add(binset)
        db.session.commit()

        #
        bin_contigs = defaultdict(list)
        contig_bins = {}
        for contig_name, bin_name in utils.parse_dsv(bin_file):
            bin_contigs[bin_name].append(contig_name)
            contig_bins[contig_name] = bin_name

        bin_objects = {}
        for bin_name in bin_contigs:
            bin = Bin(name=bin_name, binset_id=binset.id,
                      color=randcol.generate()[0])
            db.session.add(bin)
            bin_objects[bin_name] = bin

        # Create contigset if none has been chosen.
        contigset = Contigset.query.filter_by(name=contigset_name,
                                              userid=session['uid']).first()
        if contigset is None:
            contigset = Contigset(name='', userid=session['uid'])
            db.session.add(contigset)
            db.session.commit()
            contigset.name = 'contigset{}'.format(contigset.id)
            for bin_name, contigs in bin_contigs.items():
                for contig_name in contigs:
                    contig = Contig(header=contig_name,
                                    contigset_id=contigset.id)
                    bin_objects[bin_name].contigs.append(contig)
        else:
            for contig in contigset.contigs:
                bin_name = contig_bins.get(contig.header)
                if bin_name:
                    bin_objects[bin_name].contigs.append(contig)
        db.session.commit()

        obj_response.html_append('#binsetList',
                                 '<a href="#" class="list-group-item">'
                                 '{}</li>'.format(binset_name))
        obj_response.html_append('.binsetSelect',
                                 '<option>{}</option>'.format(binset_name))
        obj_response.script('Sijax.request("bin_data")')

    @staticmethod
    def update_chord(obj_response, *bin_sets):
        app.logger.debug(bin_sets)
        binset1 = Binset.query.filter_by(userid=session['uid'],
                                         name=bin_sets[0][0]).first()
        bins1 = [bin for bin in binset1.bins.all() if bin.name in bin_sets[0][1]]
        bins1 = utils.sort_bins(bins1)
        binset2 = Binset.query.filter_by(userid=session['uid'],
                                         name=bin_sets[1][0]).first()
        bins2 = [bin for bin in binset2.bins.all() if bin.name in bin_sets[1][1]]
        bins2 = utils.sort_bins(bins2, reverse=True)
        matrix = utils.to_matrix(bins1 + bins2)
        # TODO: store color in database someplace else
        colors = ['#FFDD89' for _ in bins1]
        colors.extend(['#957244' for _ in bins2])
        obj_response.call('updateChord', [matrix, colors])

    @staticmethod
    def bin_data(obj_response):
        binsets = Binset.query.filter_by(userid=session['uid']).all()
        data = []
        for binset in binsets:
            binset_data = {'binset': binset.name, 'bins': [],
                           'color': binset.color}
            for bin in binset.bins.all():
                binset_data['bins'].append({
                    'name': bin.name,
                    'contigs': [contig.header for contig in bin.contigs],
                    'color': bin.color,
                    'status': 'visible' # [visible, hidden, deleted]
                })
            data.append(binset_data)
        obj_response.script('binsets = '
                            'JSON.parse(\'{}\');'.format(json.dumps(data)))
        obj_response.script('console.log("done")')

''' Views '''
@app.before_request
def make_session_permanent():
    session.permanent = True


@app.route('/binsets')
def get_binsets():
    userid = session.get('uid')
    if userid is None:
        abort(404)
    result = []
    for binset in Binset.query.filter_by(userid=userid).all():
        binset_result = {'name': binset.name, 'color': binset.color, 'bins': []}
        for bin in binset.bins:
            binset_result['bins'].append({
                'name': bin.name, 'color': bin.color,
                'contigs': [contig.header for contig in bin.contigs]})
        result.append(binset_result)
    return json.dumps(result)


@flask_sijax.route(app, '/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())

    form_init_js = g.sijax.register_upload_callback('contigsetForm',
        SijaxHandler.contigset_form_handler)
    form_init_js += g.sijax.register_upload_callback('binsetForm',
        SijaxHandler.binset_form_handler)

    if g.sijax.is_sijax_request:
        g.sijax.register_object(SijaxHandler)
        return g.sijax.process_request()

    # User specific contig- and binsets
    contigsets = Contigset.query.filter_by(userid=session['uid']).all()
    binsets = Binset.query.filter_by(userid=session['uid']).all()
    return render_template('index.html', form_init_js=form_init_js,
                           contigsets=contigsets, binsets=binsets,
                           new_user=new_user)


if __name__ == '__main__':
    app.run(debug=True)

import uuid

from flask import Flask, render_template, g, session
from flask.ext.sqlalchemy import SQLAlchemy
import flask_sijax

import utils


app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)
flask_sijax.Sijax(app)


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

        contigsets = Contigset.query.filter_by(name=contigset_name,
                                               userid=session['uid']).all()
        if len(contigsets) > 0:
            SijaxHandler._add_alert(obj_response, '#contigsetAlerts',
                                    'Contigs zijn al geupload.')
            return

        # Create new contigset
        contigset = Contigset(name=contigset_name, userid=session['uid'])
        db.session.add(contigset)
        db.session.commit()

        # Add data to database
        contigs = 0
        for header, sequence in utils.parse_fasta(contig_file.stream):
            contig = Contig(header=header, sequence=sequence,
                            contigset_id=contigset.id)
            db.session.add(contig)
            contigs += 1
        db.session.commit()

        obj_response.html_append('#contigsetList',
            '<li class="list-group-item">'
            '<span class="badge">{}</span>'
            '{}</li>'.format(contigs, contigset_name))

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

        binsets = Binset.query.filter_by(name=binset_name,
                                         userid=session['uid']).all()
        if len(binsets) > 0: # Bins already uploaded
            SijaxHandler._add_alert(obj_response, '#binsetAlerts',
                                    'Bins zijn al geupload.')
            return

        # Create new binset
        binset = Binset(name=binset_name, userid=session['uid'])
        db.session.add(binset)
        db.session.commit()

        # Create contigset if none has been chosen.
        contigset = Contigset.query.filter_by(name=contigset_name,
                                              userid=session['uid']).all()
        if len(contigset) == 0:
            contigset = Contigset(name='', userid=session['uid'])
            db.session.add(contigset)
            db.session.commit()
            contigset.name = 'contigset{}'.format(contigset.id)
        else:
            contigset = contigset[0]

        # Add data to database
        for line in bin_file.read().decode('utf-8').split('\n'):
            if line == '':
                continue
            contig_name, bin_name = line.rstrip().split(',')

            contigs = contigset.contigs.filter_by(header=contig_name).all()
            if len(contigs) == 0:
                contig = Contig(header=contig_name, contigset_id=contigset.id)
                db.session.add(contig)
            else:
                contig = contigs[0]

            # Should be 0 if the bin hasn't been added yet, and 1 if it's
            # already been added in a previous iteration of the loop. If there
            # is more than 1, something went wrong...
            bins = binset.bins.filter_by(name=bin_name).all()
            if len(bins) == 0:
                bin = Bin(name=bin_name, binset_id=binset.id)
                bin.contigs.append(contig)
                db.session.add(bin)
            elif len(bins) == 1:
                bins[0].contigs.append(contig)
        db.session.commit()

        obj_response.html_append('#binsetList',
                                 '<a href="#" class="list-group-item">'
                                 '{}</li>'.format(binset_name))

    @staticmethod
    def update_chord(obj_response, *bin_sets):
        app.logger.debug(bin_sets)
        binset1 = Binset.query.filter_by(userid=session['uid'],
                                         name=bin_sets[0][0]).first()
        bins1 = [bin for bin in binset1.bins.all() if bin.name in bin_sets[0][1]]
        binset2 = Binset.query.filter_by(userid=session['uid'],
                                         name=bin_sets[1][0]).first()
        bins2 = [bin for bin in binset2.bins.all() if bin.name in bin_sets[1][1]]
        matrix = utils.to_matrix(bins1 + bins2)
        # TODO: store color in database someplace else
        colors = ['#FFDD89' for _ in bins1]
        colors.extend(['#957244' for _ in bins2])
        obj_response.call('updateChord', [matrix, colors])


''' Views '''
@app.before_request
def make_session_permanent():
    session.permanent = True


@flask_sijax.route(app, '/')
def home():
    if not 'uid' in session:
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
                           contigsets=contigsets, binsets=binsets)


if __name__ == '__main__':
    app.run(debug=True)

from app import db, utils


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
    gc = db.Column(db.Integer)
    N50 = db.Column(db.Integer)

    contigs = db.relationship('Contig', secondary=bincontig,
                              backref=db.backref('bins', lazy='dynamic'))

    def recalculate_values(self):
        self.gc = utils.gc_content_bin(self)
        self.N50 = utils.n50(self)

    @property
    def size(self):
        return len(self.contigs)


class Contig(db.Model):
    __tablename__ = 'contig'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    sequence = db.Column(db.String)
    length = db.Column(db.Integer)
    gc = db.Column(db.Integer)
    fourmerfreqs = db.Column(db.String)
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

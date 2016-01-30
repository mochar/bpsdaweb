from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask_restful import Api

app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)

from app.resources.contigset_list import ContigsetListApi
from app.resources.contigset import ContigsetApi
from app.resources.contig_list import ContigListApi
from app.resources.contig import ContigApi
from app.resources.binset_list import BinsetListApi
from app.resources.matrix import MatrixApi
from app.resources.binset import BinsetApi
from app.resources.bin_list import BinListApi
from app.resources.bin import BinApi

api = Api(app)
api.add_resource(ContigsetListApi, '/contigsets')
api.add_resource(ContigsetApi, '/contigsets/<int:id>')
api.add_resource(ContigListApi, '/contigsets/<int:contigset_id>/contigs')
api.add_resource(ContigApi, '/contigsets/<int:contigset_id>/contigs/<int:id>')
api.add_resource(BinsetListApi, '/contigsets/<int:contigset_id>/binsets')
api.add_resource(MatrixApi, '/contigsets/<int:contigset_id>/matrix')
api.add_resource(BinsetApi, '/contigsets/<int:contigset_id>/binsets/<int:id>')
api.add_resource(BinListApi, '/contigsets/<int:contigset_id>/binsets/<int:id>/bins')
api.add_resource(BinApi, '/contigsets/<int:contigset_id>/binsets/'
                         '<int:binset_id>/bins/<int:id>')

from app import models, views


from flask import abort
from flask.ext.restful import Resource

from .utils import user_contigset_or_404


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

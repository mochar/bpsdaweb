from flask import session, abort

from app.models import Contigset


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

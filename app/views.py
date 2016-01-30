import uuid

from flask import session, render_template

from app import app


@app.before_request
def make_session_permanent():
    session.permanent = True


@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)

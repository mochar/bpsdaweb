import uuid

from flask import session, render_template, jsonify, request
from rq import get_current_job

from app import app, q


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


@app.route('/jobs')
@app.route('/jobs/<job_id>')
def job(job_id=None):
    if job_id is None:
        jobs = [{'id': job.id, 'meta': job.meta} for job in q.jobs]
        current_job = get_current_job()
        if current_job is not None:
            jobs.append({'id': current_job.id, 'meta': current_job.meta})
        return jsonify({'jobs': jobs})
    job = q.fetch_job(job_id)
    return jsonify({'status': job.get_status()})

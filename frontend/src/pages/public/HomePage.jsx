import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import { api } from '../../lib/api.js';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function HomePage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/public/plans')
      .then(setPlans)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="simple-paper-home">
      <main className="simple-paper-main">
        <section className="simple-paper-hero">
          <div className="simple-paper-logo"><Brand link={false} /></div>
          <div className="simple-paper-hero-card">
            <span className="simple-paper-kicker">GYMFIT</span>
            <h1>Your fitness day.<br/><em>Simple. Clear. Yours.</em></h1>
            <p>Workout, diet, attendance and progress in one focused member experience.</p>
            <div className="simple-paper-actions">
              <Link className="simple-paper-btn simple-paper-btn-dark" to="/signup">Join now</Link>
              <a className="simple-paper-btn" href="#memberships">View membership</a>
            </div>
            <div className="simple-paper-note">PERSONAL COACHING <span>+</span> AI COACH</div>
          </div>
        </section>

        <section id="memberships" className="simple-paper-memberships">
          <div className="simple-paper-section-head">
            <span>MEMBERSHIP</span>
            <h2>Two ways to train.</h2>
            <p>Choose the coaching style that fits you.</p>
          </div>

          {loading && <div className="simple-paper-state">Loading memberships…</div>}
          {error && <div className="simple-paper-state error">Memberships are temporarily unavailable. Please refresh in a moment.</div>}
          {!loading && !error && (
            <div className="simple-paper-plan-grid">
              {plans.map((plan, index) => (
                <article className={`simple-paper-plan ${index === 0 ? 'simple-paper-plan-accent' : ''}`} key={plan.id}>
                  <div className="simple-paper-plan-top"><span>{plan.kind}</span><span>{plan.durationDays} DAYS</span></div>
                  <h3>{plan.name}</h3>
                  <strong className="simple-paper-price">{money(plan.price)}</strong>
                  <p>{plan.description}</p>
                  <div className="simple-paper-line"/>
                  <ul>{(plan.features || []).slice(0, 6).map(feature => <li key={feature}>{feature}</li>)}</ul>
                  <Link className="simple-paper-btn simple-paper-btn-dark simple-paper-btn-full" to="/signup">Join {plan.name}</Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="simple-paper-footer">
        <div className="simple-paper-footer-bottom">
          <span>© GymFit</span>
          <Link to="/login">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}

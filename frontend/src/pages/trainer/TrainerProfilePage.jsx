import React from 'react';

import {
  useApiData
} from '../../lib/useApiData.js';

import {
  Notice,
  PageHeader,
  Panel,
  Spinner,
  Stat
} from '../../components/UI.jsx';

export default function TrainerProfilePage() {
  const {
    data,
    error,
    loading
  } =
    useApiData(
      '/trainer/profile'
    );

  if (loading) {
    return (
      <Spinner />
    );
  }

  if (error) {
    return (
      <Notice type="error">
        {error}
      </Notice>
    );
  }

  return (
    <>

      <PageHeader
        eyebrow="TRAINER PROFILE"
        title={data.name}
        copy={data.specialty}
      />

      <section className="gym-key-panel">

        <div>
          <span className="eyebrow">
            STAFF KEY
          </span>

          <strong>
            {data.loginKey ||
              '------'}
          </strong>

          <p>
            Use this six-digit
            Gym Key to sign in.
            GymFit automatically
            opens your trainer portal.
          </p>
        </div>

      </section>

      <div className="stats-grid">

        <Stat
          label="Active clients"
          value={
            data.activeClients
          }
        />

        <Stat
          label="Capacity"
          value={
            data.capacity
          }
        />

        <Stat
          label="Available slots"
          value={Math.max(
            0,
            data.capacity -
            data.activeClients
          )}
        />

      </div>

      <Panel title="Profile">

        <div className="profile-summary">

          <div>
            <span>
              Email
            </span>

            <strong>
              {data.email ||
                '—'}
            </strong>
          </div>

          <div>
            <span>
              Phone
            </span>

            <strong>
              {data.phone ||
                '—'}
            </strong>
          </div>

          <div>
            <span>
              Specialty
            </span>

            <strong>
              {data.specialty}
            </strong>
          </div>

        </div>

      </Panel>

    </>
  );
}
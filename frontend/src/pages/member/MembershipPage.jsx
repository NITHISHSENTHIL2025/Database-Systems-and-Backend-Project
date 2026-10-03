import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useSearchParams
} from 'react-router-dom';

import {
  api,
  json
} from '../../lib/api.js';

import {
  useApiData
} from '../../lib/useApiData.js';

import {
  Empty,
  Modal,
  Notice,
  PageHeader,
  Panel,
  Spinner,
  Status
} from '../../components/UI.jsx';

function money(value) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }
  ).format(
    Number(value) || 0
  );
}

let cashfreePromise;

function loadCashfree() {
  if (window.Cashfree) {
    return Promise.resolve(
      window.Cashfree
    );
  }

  if (!cashfreePromise) {
    cashfreePromise =
      new Promise(
        (
          resolve,
          reject
        ) => {
          const script =
            document.createElement(
              'script'
            );

          script.src =
            'https://sdk.cashfree.com/js/v3/cashfree.js';

          script.onload =
            () =>
              resolve(
                window.Cashfree
              );

          script.onerror =
            () =>
              reject(
                new Error(
                  'Could not load Cashfree checkout SDK.'
                )
              );

          document.head.appendChild(
            script
          );
        }
      );
  }

  return cashfreePromise;
}

export default function MembershipPage() {
  const history =
    useApiData(
      '/member/membership'
    );

  const profile =
    useApiData(
      '/member/profile'
    );

  const [
    plans,
    setPlans
  ] = useState([]);

  const [
    error,
    setError
  ] = useState('');

  const [
    busy,
    setBusy
  ] = useState(null);

  const [
    message,
    setMessage
  ] = useState('');

  const [
    showBasics,
    setShowBasics
  ] = useState(false);

  const [
    basics,
    setBasics
  ] = useState({
    age: '',
    heightCm: '',
    weightKg: '',
    bodyType: ''
  });

  const [
    params,
    setParams
  ] = useSearchParams();

  useEffect(() => {
    api('/public/plans')
      .then(setPlans)
      .catch(err =>
        setError(
          err.message
        )
      );
  }, []);

  useEffect(() => {
    if (!profile.data) {
      return;
    }

    setBasics({
      age:
        profile.data.age ??
        '',

      heightCm:
        profile.data.heightCm ??
        '',

      weightKg:
        profile.data.weightKg ??
        '',

      bodyType:
        profile.data.bodyType ||
        ''
    });

    const hasActive =
      history.data?.some(
        membership =>
          membership.status ===
          'ACTIVE'
      );

    if (
      hasActive &&
      !profile.data
        .fitnessProfileComplete
    ) {
      setShowBasics(true);
    }
  }, [
    profile.data,
    history.data
  ]);

  useEffect(() => {
    const orderId =
      params.get(
        'order_id'
      );

    if (!orderId) {
      return;
    }

    setBusy('verify');

    api(
      `/member/payments/verify/${encodeURIComponent(
        orderId
      )}`
    )
      .then(async result => {
        if (
          result.status ===
          'PAID'
        ) {
          setMessage(
            'Payment verified. Your membership is active.'
          );
        }

        await history.reload();

        const fresh =
          await profile.reload();

        if (
          fresh &&
          !fresh.fitnessProfileComplete
        ) {
          setShowBasics(
            true
          );
        }

        params.delete(
          'order_id'
        );

        setParams(
          params,
          {
            replace: true
          }
        );
      })
      .catch(err =>
        setMessage(
          err.message
        )
      )
      .finally(
        () =>
          setBusy(null)
      );
  }, []);

  const active =
    useMemo(
      () =>
        history.data?.find(
          membership =>
            membership.status ===
            'ACTIVE'
        ) || null,
      [history.data]
    );

  function planAction(plan) {
    if (!active) {
      return {
        disabled: false,
        label:
          `Buy ${plan.name}`
      };
    }

    const ends =
      new Date(
        active.endDate
      ).toLocaleDateString(
        'en-IN'
      );

    if (
      active.plan.kind ===
      plan.kind
    ) {
      return {
        disabled: true,

        label:
          `Current plan · ends ${ends}`
      };
    }

    if (
      active.plan.kind ===
        'AI' &&
      plan.kind ===
        'PERSONAL'
    ) {
      return {
        disabled: false,

        label:
          'Upgrade to Personal Coaching'
      };
    }

    return {
      disabled: true,

      label:
        `Available after ${ends}`
    };
  }

  async function buy(plan) {
    const action =
      planAction(plan);

    if (action.disabled) {
      return;
    }

    setBusy(
      plan.id
    );

    setMessage('');

    try {
      const order =
        await api(
          '/member/payments/order',

          json(
            'POST',
            {
              planId:
                plan.id
            }
          )
        );

      const Cashfree =
        await loadCashfree();

      const cashfree =
        Cashfree({
          mode:
            order.mode ||
            'sandbox'
        });

      await cashfree.checkout({
        paymentSessionId:
          order.paymentSessionId,

        redirectTarget:
          '_modal'
      });

      const verified =
        await api(
          `/member/payments/verify/${encodeURIComponent(
            order.orderId
          )}`
        );

      if (
        verified.status ===
        'PAID'
      ) {
        setMessage(
          active?.plan?.kind ===
            'AI' &&
          plan.kind ===
            'PERSONAL'
            ? 'Payment verified. Membership upgraded to Personal Coaching.'
            : 'Payment verified and membership activated.'
        );
      } else {
        setMessage(
          'Payment is not confirmed yet. You can verify again from this page.'
        );
      }

      await history.reload();

      const fresh =
        await profile.reload();

      if (
        verified.status ===
          'PAID' &&
        fresh &&
        !fresh.fitnessProfileComplete
      ) {
        setShowBasics(
          true
        );
      }
    } catch (err) {
      setMessage(
        err.message
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveBasics(e) {
    e.preventDefault();

    setBusy(
      'basics'
    );

    setMessage('');

    try {
      await api(
        '/member/profile',

        json(
          'PATCH',
          {
            name:
              profile.data.name,

            phone:
              profile.data.phone ||
              '',

            goal:
              profile.data.goal ||
              '',

            age:
              Number(
                basics.age
              ),

            heightCm:
              Number(
                basics.heightCm
              ),

            weightKg:
              Number(
                basics.weightKg
              ),

            bodyType:
              basics.bodyType
          }
        )
      );

      await profile.reload();

      setShowBasics(
        false
      );

      setMessage(
        'Fitness profile completed. Your coaching setup is ready.'
      );
    } catch (err) {
      setMessage(
        err.message
      );
    } finally {
      setBusy(null);
    }
  }

  if (
    history.loading ||
    profile.loading
  ) {
    return (
      <Spinner label="Loading membership" />
    );
  }

  return (
    <>

      <PageHeader
        eyebrow="MEMBERSHIP"

        title="Two paths. One goal: consistency."

        copy="Choose Personal Coaching or AI Coach and activate your access securely."
      />

      {(history.error ||
        profile.error ||
        error) && (
        <Notice type="error">
          {history.error ||
            profile.error ||
            error}
        </Notice>
      )}

      {message && (
        <Notice
          type={
            message
              .toLowerCase()
              .includes(
                'verified'
              ) ||
            message
              .toLowerCase()
              .includes(
                'upgraded'
              )
              ? 'success'
              : 'info'
          }
        >
          {message}
        </Notice>
      )}

      <div className="membership-buy-heading">

        <span className="eyebrow">
          CHOOSE MEMBERSHIP
        </span>

        <h2>
          {active
            ? 'Manage your membership'
            : 'Activate your plan'}
        </h2>

      </div>

      {plans.length === 0 &&
        !error && (
          <Notice type="info">
            Membership plans are
            temporarily unavailable.
          </Notice>
        )}

      <div className="membership-two-grid">

        {plans.map(
          plan => {
            const action =
              planAction(plan);

            return (
              <article
                className={`membership-choice kind-${plan.kind.toLowerCase()}`}
                key={plan.id}
              >

                <div className="plan-top">

                  <span>
                    {plan.kind}
                  </span>

                  <span>
                    {plan.durationDays}{' '}
                    DAYS
                  </span>

                </div>

                <h2>
                  {plan.name}
                </h2>

                <div className="plan-price">
                  {money(
                    plan.price
                  )}
                </div>

                <p>
                  {plan.description}
                </p>

                <ul>
                  {(plan.features ||
                    []).map(
                    feature => (
                      <li
                        key={
                          feature
                        }
                      >
                        {feature}
                      </li>
                    )
                  )}
                </ul>

                <button
                  className="button button-dark button-full"

                  disabled={
                    busy !== null ||
                    action.disabled
                  }

                  onClick={() =>
                    buy(plan)
                  }
                >
                  {busy ===
                  plan.id
                    ? 'Opening secure checkout…'
                    : action.label}
                </button>

              </article>
            );
          }
        )}

      </div>

      <Panel title="Current access">

        {active ? (
          <div className="membership-summary">

            <div>
              <span>
                Plan
              </span>

              <strong>
                {
                  active.plan
                    .name
                }
              </strong>
            </div>

            <div>
              <span>
                Type
              </span>

              <strong>
                {
                  active.plan
                    .kind
                }
              </strong>
            </div>

            <div>
              <span>
                Status
              </span>

              <Status
                value={
                  active.status
                }
              />
            </div>

            <div>
              <span>
                Ends
              </span>

              <strong>
                {new Date(
                  active.endDate
                ).toLocaleDateString(
                  'en-IN'
                )}
              </strong>
            </div>

          </div>
        ) : (
          <Empty
            title="No active membership"

            copy="Choose one of the memberships above."
          />
        )}

        {active?.plan.kind ===
          'PERSONAL' && (
          <div className="membership-callout">

            <strong>
              {profile.data
                ?.trainer
                ? `Trainer: ${profile.data.trainer.name}`
                : 'Trainer assignment pending'}
            </strong>

            <span>
              {profile.data
                ?.trainer
                ? profile.data
                    .trainer
                    .specialty
                : 'Admin will assign an available trainer after Personal Coaching is active.'}
            </span>

          </div>
        )}

        {active?.plan.kind ===
          'AI' &&
          !profile.data
            ?.aiProfile && (
            <div className="membership-callout">

              <strong>
                AI onboarding required
              </strong>

              <span>
                Complete your fitness
                basics and AI preferences
                to generate your program.
              </span>

              <Link
                className="button button-primary"
                to="/member/profile"
              >
                Complete AI setup
              </Link>

            </div>
          )}

      </Panel>

      {showBasics && (
        <Modal
          title="Complete your fitness profile"

          onClose={() =>
            setShowBasics(
              false
            )
          }
        >

          <p className="modal-copy">
            Your membership is active.
            Add these four basics once
            so GymFit can personalize
            workouts, diet and coaching
            analytics.
          </p>

          <form
            className="portal-form"
            onSubmit={
              saveBasics
            }
          >

            <div className="form-grid two">

              <label>
                Age

                <input
                  type="number"
                  min="18"
                  max="80"
                  required

                  value={
                    basics.age
                  }

                  onChange={e =>
                    setBasics({
                      ...basics,

                      age:
                        e.target
                          .value
                    })
                  }
                />
              </label>

              <label>
                Height (cm)

                <input
                  type="number"
                  min="120"
                  max="230"
                  step="0.1"
                  required

                  value={
                    basics.heightCm
                  }

                  onChange={e =>
                    setBasics({
                      ...basics,

                      heightCm:
                        e.target
                          .value
                    })
                  }
                />
              </label>

              <label>
                Weight (kg)

                <input
                  type="number"
                  min="30"
                  max="300"
                  step="0.1"
                  required

                  value={
                    basics.weightKg
                  }

                  onChange={e =>
                    setBasics({
                      ...basics,

                      weightKg:
                        e.target
                          .value
                    })
                  }
                />
              </label>

              <label>
                Body type

                <select
                  required

                  value={
                    basics.bodyType
                  }

                  onChange={e =>
                    setBasics({
                      ...basics,

                      bodyType:
                        e.target
                          .value
                    })
                  }
                >

                  <option value="">
                    Select body type
                  </option>

                  <option value="SLIM">
                    Slim
                  </option>

                  <option value="AVERAGE">
                    Average
                  </option>

                  <option value="ATHLETIC">
                    Athletic
                  </option>

                  <option value="HEAVY">
                    Heavy build
                  </option>

                </select>
              </label>

            </div>

            <p className="form-help">
              These are profile inputs,
              not medical measurements.
              You can change them later
              from Profile.
            </p>

            <button
              className="button button-primary button-full"

              disabled={
                busy ===
                'basics'
              }
            >
              {busy ===
              'basics'
                ? 'Saving…'
                : 'Save & continue'}
            </button>

          </form>

        </Modal>
      )}

      <Panel title="Membership history">

        {history.data
          ?.length ? (
          <div className="data-table-wrap">

            <table className="data-table">

              <thead>
                <tr>
                  <th>
                    Plan
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Period
                  </th>

                  <th>
                    Paid
                  </th>
                </tr>
              </thead>

              <tbody>

                {history.data.map(
                  membership => (
                    <tr
                      key={
                        membership.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            membership
                              .plan
                              .name
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          membership
                            .plan
                            .kind
                        }
                      </td>

                      <td>
                        <Status
                          value={
                            membership
                              .status
                          }
                        />
                      </td>

                      <td>
                        {new Date(
                          membership
                            .startDate
                        ).toLocaleDateString(
                          'en-IN'
                        )}
                        {' → '}
                        {new Date(
                          membership
                            .endDate
                        ).toLocaleDateString(
                          'en-IN'
                        )}
                      </td>

                      <td>
                        {money(
                          membership
                            .amountPaid
                        )}
                      </td>
                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        ) : (
          <Empty />
        )}

      </Panel>

    </>
  );
}
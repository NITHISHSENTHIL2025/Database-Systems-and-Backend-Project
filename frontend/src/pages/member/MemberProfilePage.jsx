import React, {
  useEffect,
  useState
} from 'react';

import {
  api,
  json
} from '../../lib/api.js';

import {
  useApiData
} from '../../lib/useApiData.js';

import {
  Notice,
  PageHeader,
  Panel,
  Spinner
} from '../../components/UI.jsx';

const GOAL_OPTIONS = [
  ['MUSCLE_GAIN', 'Muscle Gain'],
  ['FAT_LOSS', 'Fat Loss'],
  ['STRENGTH', 'Strength'],
  ['FITNESS', 'General Fitness']
];

const SLEEP_OPTIONS = Array.from(
  { length: 19 },
  (_, index) => 3 + index * 0.5
);

const blankForm = {
  name: '',
  phone: '',
  goal: '',
  age: '',
  heightCm: '',
  weightKg: '',
  bodyType: ''
};

const blankAI = {
  gender: 'MALE',
  targetWeightKg: '',
  experience: 'BEGINNER',
  trainingDays: 4,
  sessionMinutes: 60,
  dietPreference: 'VEGETARIAN',
  allergies: '',
  dislikedFoods: '',
  activityLevel: 'MODERATE',
  equipmentAccess: 'GYM',
  sleepHours: 7
};

function normalizeStoredGoal(goal) {
  const value = String(goal || '')
    .trim()
    .toUpperCase();

  if (!value) return '';

  if (
    value.includes('MUSCLE') ||
    value.includes('GAIN')
  ) {
    return 'MUSCLE_GAIN';
  }

  if (
    value.includes('FAT') ||
    value.includes('LOSS') ||
    value.includes('LOSE')
  ) {
    return 'FAT_LOSS';
  }

  if (value.includes('STRENGTH')) {
    return 'STRENGTH';
  }

  return 'FITNESS';
}

export default function MemberProfilePage() {
  const {
    data,
    error,
    loading,
    reload
  } = useApiData('/member/profile');

  const [form, setForm] = useState(blankForm);
  const [ai, setAi] = useState(blankAI);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }

    setForm({
      name: data.name || '',
      phone: data.phone || '',
      goal: normalizeStoredGoal(data.goal),
      age: data.age ?? '',
      heightCm: data.heightCm ?? '',
      weightKg: data.weightKg ?? '',
      bodyType: data.bodyType || ''
    });

    if (data.aiProfile) {
      setAi({
        ...blankAI,
        ...data.aiProfile,
        targetWeightKg:
          data.aiProfile.targetWeightKg ?? '',
        allergies:
          data.aiProfile.allergies ?? '',
        dislikedFoods:
          data.aiProfile.dislikedFoods ?? '',
        sleepHours:
          data.aiProfile.sleepHours ?? ''
      });
    } else {
      setAi(blankAI);
    }
  }, [data]);

  if (loading) {
    return (
      <Spinner label="Loading profile" />
    );
  }

  if (error) {
    return (
      <Notice type="error">
        {error}
      </Notice>
    );
  }

  async function saveProfile(e) {
    e.preventDefault();

    setBusy('profile');
    setMessage('');

    try {
      await api(
        '/member/profile',
        json(
          'PATCH',
          {
            name: form.name,
            phone: form.phone,
            goal: form.goal,
            age:
              form.age === ''
                ? null
                : Number(form.age),
            heightCm:
              form.heightCm === ''
                ? null
                : Number(form.heightCm),
            weightKg:
              form.weightKg === ''
                ? null
                : Number(form.weightKg),
            bodyType:
              form.bodyType || null
          }
        )
      );

      setMessage('Profile saved.');
      await reload();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  async function saveAI(e) {
    e.preventDefault();

    setBusy('ai');
    setMessage('');

    try {
      await api(
        '/member/ai-profile',
        json(
          'PUT',
          {
            gender: ai.gender,
            targetWeightKg:
              ai.targetWeightKg === ''
                ? null
                : Number(ai.targetWeightKg),
            experience: ai.experience,
            trainingDays:
              Number(ai.trainingDays),
            sessionMinutes:
              Number(ai.sessionMinutes),
            dietPreference:
              ai.dietPreference,
            allergies:
              ai.allergies || null,
            dislikedFoods:
              ai.dislikedFoods || null,
            activityLevel:
              ai.activityLevel,
            equipmentAccess:
              ai.equipmentAccess,
            sleepHours:
              ai.sleepHours === ''
                ? null
                : Number(ai.sleepHours)
          }
        )
      );

      setMessage(
        'AI Coach preferences saved.'
      );

      await reload();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  async function copyKey() {
    await navigator.clipboard?.writeText(
      data.loginKey || ''
    );

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      1300
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="PROFILE"
        title="Your GymFit profile."
        copy="Keep your fitness basics accurate for coaching and progress tracking."
      />

      {message && (
        <Notice
          type={
            message
              .toLowerCase()
              .includes('saved')
              ? 'success'
              : 'error'
          }
        >
          {message}
        </Notice>
      )}

      <section className="gym-key-panel">
        <div>
          <span className="eyebrow">
            YOUR GYM KEY
          </span>

          <strong>
            {data.loginKey || '------'}
          </strong>

          <p>
            Use this six-digit Gym Key to sign in
            from any device. Keep it private.
          </p>
        </div>

        <button
          type="button"
          className="button button-dark"
          onClick={copyKey}
        >
          {copied
            ? 'Copied'
            : 'Copy key'}
        </button>
      </section>

      <div className="portal-grid two-thirds">
        <Panel title="Basic profile">
          <form
            className="portal-form"
            onSubmit={saveProfile}
          >
            <div className="form-grid two">
              <label>
                Name

                <input
                  autoComplete="name"
                  value={form.name}
                  onChange={e =>
                    setForm({
                      ...form,
                      name: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label>
                Email

                <input
                  value={data.email}
                  disabled
                />
              </label>

              <label>
                Phone

                <input
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={e =>
                    setForm({
                      ...form,
                      phone: e.target.value
                    })
                  }
                />
              </label>

              <label>
                Fitness goal

                <select
                  value={form.goal}
                  onChange={e =>
                    setForm({
                      ...form,
                      goal: e.target.value
                    })
                  }
                  required
                >
                  <option value="">
                    Select your goal
                  </option>

                  {GOAL_OPTIONS.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Age

                <input
                  type="number"
                  min="18"
                  max="80"
                  value={form.age}
                  onChange={e =>
                    setForm({
                      ...form,
                      age: e.target.value
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
                  value={form.heightCm}
                  onChange={e =>
                    setForm({
                      ...form,
                      heightCm: e.target.value
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
                  value={form.weightKg}
                  onChange={e =>
                    setForm({
                      ...form,
                      weightKg: e.target.value
                    })
                  }
                />
              </label>

              <label>
                Body type

                <select
                  value={form.bodyType}
                  onChange={e =>
                    setForm({
                      ...form,
                      bodyType: e.target.value
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

            <button
              className="button button-primary"
              disabled={busy === 'profile'}
            >
              {busy === 'profile'
                ? 'Saving…'
                : 'Save profile'}
            </button>
          </form>
        </Panel>

        <Panel title="Current coaching">
          <div className="profile-summary">
            <div>
              <span>
                Membership
              </span>

              <strong>
                {data.membership?.name || 'None'}
              </strong>
            </div>

            <div>
              <span>
                Mode
              </span>

              <strong>
                {data.membership?.kind || '—'}
              </strong>
            </div>

            <div>
              <span>
                Trainer
              </span>

              <strong>
                {data.trainer?.name || '—'}
              </strong>
            </div>

            <div>
              <span>
                Profile basics
              </span>

              <strong>
                {data.fitnessProfileComplete
                  ? 'Complete'
                  : 'Needs setup'}
              </strong>
            </div>
          </div>
        </Panel>
      </div>

      {data.membership?.kind === 'AI' && (
        <Panel
          title="AI Coach setup"
          copy="These controlled preferences help GymFit generate a consistent plan. Age, height, weight, body type and fitness goal come from your basic profile above."
        >
          {!data.fitnessProfileComplete && (
            <Notice type="info">
              Complete age, height, weight and
              body type first.
            </Notice>
          )}

          <form
            className="portal-form"
            onSubmit={saveAI}
          >
            <div className="form-grid three">
              <label>
                Gender

                <select
                  value={ai.gender}
                  onChange={e =>
                    setAi({
                      ...ai,
                      gender: e.target.value
                    })
                  }
                >
                  <option value="MALE">
                    Male
                  </option>

                  <option value="FEMALE">
                    Female
                  </option>

                  <option value="OTHER">
                    Other / not specified
                  </option>
                </select>
              </label>

              <label>
                Experience

                <select
                  value={ai.experience}
                  onChange={e =>
                    setAi({
                      ...ai,
                      experience: e.target.value
                    })
                  }
                >
                  <option value="BEGINNER">
                    Beginner
                  </option>

                  <option value="INTERMEDIATE">
                    Intermediate
                  </option>

                  <option value="ADVANCED">
                    Advanced
                  </option>
                </select>
              </label>

              <label>
                Training days / week

                <select
                  value={ai.trainingDays}
                  onChange={e =>
                    setAi({
                      ...ai,
                      trainingDays: e.target.value
                    })
                  }
                >
                  {[3, 4, 5, 6].map(day => (
                    <option
                      key={day}
                      value={day}
                    >
                      {day} days
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Session duration

                <select
                  value={ai.sessionMinutes}
                  onChange={e =>
                    setAi({
                      ...ai,
                      sessionMinutes: e.target.value
                    })
                  }
                >
                  {[30, 45, 60, 75, 90].map(
                    minutes => (
                      <option
                        key={minutes}
                        value={minutes}
                      >
                        {minutes} minutes
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Diet preference

                <select
                  value={ai.dietPreference}
                  onChange={e =>
                    setAi({
                      ...ai,
                      dietPreference: e.target.value
                    })
                  }
                >
                  <option value="VEGETARIAN">
                    Vegetarian
                  </option>

                  <option value="NON_VEGETARIAN">
                    Non-vegetarian
                  </option>

                  <option value="VEGAN">
                    Vegan
                  </option>
                </select>
              </label>

              <label>
                Activity level

                <select
                  value={ai.activityLevel}
                  onChange={e =>
                    setAi({
                      ...ai,
                      activityLevel: e.target.value
                    })
                  }
                >
                  <option value="LOW">
                    Low
                  </option>

                  <option value="LIGHT">
                    Light
                  </option>

                  <option value="MODERATE">
                    Moderate
                  </option>

                  <option value="HIGH">
                    High
                  </option>
                </select>
              </label>

              <label>
                Equipment access

                <select
                  value={ai.equipmentAccess}
                  onChange={e =>
                    setAi({
                      ...ai,
                      equipmentAccess: e.target.value
                    })
                  }
                >
                  <option value="GYM">
                    Full gym
                  </option>

                  <option value="HOME">
                    Home equipment
                  </option>

                  <option value="LIMITED">
                    Limited equipment
                  </option>
                </select>
              </label>

              <label>
                Sleep per night

                <select
                  value={ai.sleepHours}
                  onChange={e =>
                    setAi({
                      ...ai,
                      sleepHours: e.target.value
                    })
                  }
                >
                  <option value="">
                    Not set
                  </option>

                  {SLEEP_OPTIONS.map(hours => (
                    <option
                      key={hours}
                      value={hours}
                    >
                      {hours} hours
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Target weight (kg)

                <input
                  type="number"
                  min="30"
                  max="300"
                  step="0.1"
                  value={ai.targetWeightKg}
                  onChange={e =>
                    setAi({
                      ...ai,
                      targetWeightKg: e.target.value
                    })
                  }
                />
              </label>

              <label>
                Allergies

                <input
                  placeholder="e.g. peanuts, milk"
                  value={ai.allergies}
                  onChange={e =>
                    setAi({
                      ...ai,
                      allergies: e.target.value
                    })
                  }
                />
              </label>

              <label>
                Disliked foods

                <input
                  placeholder="e.g. tofu, eggs"
                  value={ai.dislikedFoods}
                  onChange={e =>
                    setAi({
                      ...ai,
                      dislikedFoods: e.target.value
                    })
                  }
                />
              </label>
            </div>

            <p className="form-help">
              Allergies and disliked foods stay free-text because
              those choices vary from person to person. Numeric body
              measurements also remain numeric inputs instead of dropdowns.
            </p>

            <button
              className="button button-primary"
              disabled={
                busy === 'ai' ||
                !data.fitnessProfileComplete
              }
            >
              {busy === 'ai'
                ? 'Building…'
                : 'Save AI setup'}
            </button>
          </form>
        </Panel>
      )}
    </>
  );
}

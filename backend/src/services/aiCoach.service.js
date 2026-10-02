import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/http.js';
import { addDaysKey, dateKey } from '../utils/date.js';
import { publishEvent } from './events.service.js';

const workouts = {
  MUSCLE_GAIN: [
    { title: 'Push Strength', items: [['Bench Press','Chest',3,'8-10'],['Incline Dumbbell Press','Chest',3,'10-12'],['Shoulder Press','Shoulders',3,'8-10'],['Lateral Raise','Shoulders',3,'12-15'],['Triceps Pushdown','Triceps',3,'10-12']] },
    { title: 'Pull Strength', items: [['Lat Pulldown','Back',3,'8-12'],['Seated Cable Row','Back',3,'10-12'],['Romanian Deadlift','Hamstrings',3,'8-10'],['Face Pull','Rear Delts',3,'12-15'],['Dumbbell Curl','Biceps',3,'10-12']] },
    { title: 'Leg Strength', items: [['Squat','Quads',3,'6-10'],['Leg Press','Quads',3,'10-12'],['Romanian Deadlift','Hamstrings',3,'8-10'],['Leg Curl','Hamstrings',3,'10-12'],['Standing Calf Raise','Calves',3,'12-15']] },
    { title: 'Upper Hypertrophy', items: [['Incline Press','Chest',3,'10-12'],['Chest Supported Row','Back',3,'10-12'],['Machine Shoulder Press','Shoulders',3,'10-12'],['Cable Fly','Chest',2,'12-15'],['Cable Curl','Biceps',2,'12-15'],['Rope Extension','Triceps',2,'12-15']] },
    { title: 'Lower Hypertrophy', items: [['Hack Squat','Quads',3,'8-12'],['Hip Thrust','Glutes',3,'8-12'],['Walking Lunge','Legs',3,'10 / leg'],['Leg Extension','Quads',2,'12-15'],['Seated Leg Curl','Hamstrings',2,'12-15']] }
  ],
  FAT_LOSS: [
    { title: 'Full Body A', items: [['Goblet Squat','Legs',3,'10-12'],['Dumbbell Bench Press','Chest',3,'10-12'],['Lat Pulldown','Back',3,'10-12'],['Romanian Deadlift','Hamstrings',3,'10'],['Incline Walk','Cardio',1,'15 min']] },
    { title: 'Conditioning + Core', items: [['Bike Intervals','Cardio',8,'45 sec'],['Cable Row','Back',3,'12'],['Walking Lunge','Legs',3,'10 / leg'],['Plank','Core',3,'40 sec'],['Dead Bug','Core',3,'10 / side']] },
    { title: 'Full Body B', items: [['Leg Press','Legs',3,'12'],['Shoulder Press','Shoulders',3,'10'],['Seated Row','Back',3,'12'],['Hip Thrust','Glutes',3,'12'],['Treadmill Walk','Cardio',1,'20 min']] },
    { title: 'Strength Circuit', items: [['Kettlebell Deadlift','Posterior Chain',3,'12'],['Push Up','Chest',3,'AMRAP'],['Cable Pulldown','Back',3,'12'],['Step Up','Legs',3,'10 / leg'],['Farmer Carry','Full Body',4,'30 sec']] }
  ],
  STRENGTH: [
    { title: 'Squat Focus', items: [['Back Squat','Legs',4,'5'],['Bench Press','Chest',3,'6'],['Lat Pulldown','Back',3,'8'],['Leg Curl','Hamstrings',3,'10']] },
    { title: 'Bench Focus', items: [['Bench Press','Chest',4,'5'],['Romanian Deadlift','Hamstrings',3,'6'],['Barbell Row','Back',3,'6-8'],['Triceps Pushdown','Triceps',3,'10']] },
    { title: 'Deadlift Focus', items: [['Deadlift','Posterior Chain',3,'5'],['Overhead Press','Shoulders',4,'5'],['Front Squat','Legs',3,'6'],['Seated Row','Back',3,'8']] },
    { title: 'Strength Volume', items: [['Leg Press','Legs',3,'8'],['Incline Press','Chest',3,'8'],['Chest Supported Row','Back',3,'8'],['Lateral Raise','Shoulders',3,'12']] }
  ],
  FITNESS: [
    { title: 'Total Body Fitness', items: [['Goblet Squat','Legs',3,'12'],['Push Up','Chest',3,'10-15'],['Cable Row','Back',3,'12'],['Kettlebell Deadlift','Posterior Chain',3,'12'],['Bike','Cardio',1,'12 min']] },
    { title: 'Cardio + Mobility', items: [['Treadmill Walk/Jog','Cardio',1,'25 min'],['World Greatest Stretch','Mobility',2,'6 / side'],['Glute Bridge','Glutes',3,'12'],['Bird Dog','Core',3,'8 / side']] },
    { title: 'Functional Strength', items: [['Step Up','Legs',3,'10 / leg'],['Dumbbell Press','Chest',3,'10'],['Lat Pulldown','Back',3,'10'],['Farmer Carry','Full Body',4,'30 sec'],['Plank','Core',3,'40 sec']] }
  ]
};

function normalizeGoal(goal = '') {
  const v = goal.toUpperCase();
  if (v.includes('MUSCLE') || v.includes('GAIN')) return 'MUSCLE_GAIN';
  if (v.includes('FAT') || v.includes('LOSS') || v.includes('LOSE')) return 'FAT_LOSS';
  if (v.includes('STRENGTH')) return 'STRENGTH';
  return 'FITNESS';
}

function nutrition(profile, goal) {
  const weight = Math.max(35, Math.min(220, profile.weightKg));
  const height = Math.max(130, Math.min(220, profile.heightCm));
  const age = Math.max(18, Math.min(80, profile.age));
  const sexOffset = String(profile.gender).toUpperCase().startsWith('F') ? -161 : 5;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const factors = { LOW: 1.3, LIGHT: 1.4, MODERATE: 1.55, HIGH: 1.7 };
  const maintenance = bmr * (factors[String(profile.activityLevel || 'MODERATE').toUpperCase()] || 1.55);
  let calories = maintenance;
  if (goal === 'FAT_LOSS') calories -= 350;
  if (goal === 'MUSCLE_GAIN') calories += 250;
  calories = Math.round(Math.max(1500, Math.min(4000, calories)) / 50) * 50;
  const protein = Math.round(weight * (goal === 'MUSCLE_GAIN' || goal === 'STRENGTH' ? 1.7 : 1.5));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, waterMl: Math.round(weight * 35 / 250) * 250, steps: goal === 'FAT_LOSS' ? 10000 : 8000 };
}

function restrictionTerms(profile) {
  return `${profile.allergies || ''},${profile.dislikedFoods || ''}`
    .toLowerCase().split(/[,;]+/).map(x => x.trim()).filter(Boolean);
}

function safeItems(items, profile) {
  const terms = restrictionTerms(profile);
  const filtered = items.filter(item => !terms.some(term => item.toLowerCase().includes(term)));
  return filtered.length ? filtered : ['Use a suitable food from your preference that avoids the listed restrictions'];
}

function mealTemplates(profile, targets) {
  const pref = String(profile.dietPreference || '').toUpperCase();
  const meals = pref === 'VEGAN' ? [
    ['Breakfast','08:00',['Oats with plant milk','Banana','Peanut or seed topping']],
    ['Lunch','13:00',['Rice or chapati','Dal','Tofu / soy','Mixed vegetables']],
    ['Snack','17:00',['Fruit','Roasted chana','Plant yogurt']],
    ['Dinner','20:30',['Chapati','Tofu / soy','Vegetables','Dal']]
  ] : pref === 'NON_VEGETARIAN' ? [
    ['Breakfast','08:00',['Oats with milk','Banana','Eggs']],
    ['Lunch','13:00',['Rice or chapati','Chicken / fish','Dal','Mixed vegetables']],
    ['Snack','17:00',['Fruit','Curd','Eggs / roasted chana']],
    ['Dinner','20:30',['Chapati or rice','Chicken / eggs','Vegetables','Curd']]
  ] : [
    ['Breakfast','08:00',['Oats with milk','Banana','Curd or paneer side']],
    ['Lunch','13:00',['Rice or chapati','Dal','Paneer / soy','Mixed vegetables']],
    ['Snack','17:00',['Fruit','Curd','Roasted chana']],
    ['Dinner','20:30',['Chapati','Paneer / tofu','Vegetables','Curd']]
  ];
  const shares = [0.25, 0.35, 0.15, 0.25];
  return meals.map((m, i) => ({
    name: m[0], timeLabel: m[1], items: safeItems(m[2], profile), position: i,
    calories: Math.round(targets.calories * shares[i]),
    protein: Math.round(targets.protein * shares[i]),
    carbs: Math.round(targets.carbs * shares[i]),
    fat: Math.round(targets.fat * shares[i])
  }));
}

const homeMap = new Map([
  ['Bench Press','Push Up / Floor Press'],['Incline Dumbbell Press','Feet-elevated Push Up'],['Shoulder Press','Pike Push Up / Dumbbell Press'],
  ['Triceps Pushdown','Close-grip Push Up'],['Lat Pulldown','Band Row / One-arm Dumbbell Row'],['Seated Cable Row','One-arm Dumbbell Row'],
  ['Romanian Deadlift','Backpack / Dumbbell Romanian Deadlift'],['Face Pull','Band Pull-apart'],['Cable Curl','Dumbbell / Band Curl'],
  ['Leg Press','Goblet Squat'],['Leg Curl','Slider Leg Curl'],['Hack Squat','Goblet Squat'],['Cable Fly','Push Up'],['Cable Row','Band Row'],
  ['Machine Shoulder Press','Pike Push Up / Dumbbell Press'],['Chest Supported Row','One-arm Row'],['Barbell Row','Dumbbell Row'],['Deadlift','Dumbbell / Backpack Deadlift'],
  ['Back Squat','Goblet Squat'],['Front Squat','Goblet Squat'],['Bike Intervals','Fast Walk / Step Intervals'],['Treadmill Walk','Brisk Walk'],
  ['Treadmill Walk/Jog','Walk / Jog'],['Cable Pulldown','Band Pulldown'],['Kettlebell Deadlift','Backpack Deadlift'],['Farmer Carry','Loaded Bag Carry']
]);

function adaptExercises(items, profile, volumeDelta = 0) {
  const access = String(profile.equipmentAccess || 'GYM').toUpperCase();
  const experience = String(profile.experience || 'BEGINNER').toUpperCase();
  const maxItems = profile.sessionMinutes <= 40 ? 4 : profile.sessionMinutes <= 60 ? 5 : 6;
  return items.slice(0, maxItems).map((it, index) => {
    const name = access === 'GYM' ? it[0] : (homeMap.get(it[0]) || it[0]);
    let sets = Number(it[2]);
    if (experience === 'BEGINNER') sets = Math.min(sets, 3);
    if (experience === 'ADVANCED' && index < 2 && sets < 5) sets += 1;
    if (index < 2 && volumeDelta !== 0) sets = Math.max(2, Math.min(5, sets + volumeDelta));
    return [name, it[1], sets, it[3]];
  });
}

function trainingIndexes(days) {
  const clamped = Math.max(3, Math.min(6, days));
  if (clamped === 3) return [0,2,4];
  if (clamped === 4) return [0,1,3,5];
  if (clamped === 5) return [0,1,2,4,5];
  return [0,1,2,3,4,5];
}

export async function assertAIActive(memberId) {
  const now = new Date();
  const membership = await prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now }, plan: { kind: 'AI' } },
    include: { plan: true },
    orderBy: { endDate: 'desc' }
  });
  if (!membership) throw new AppError(403, 'An active AI Coach membership is required.');
  return membership;
}

export async function generateAIWeek(memberId, start = dateKey()) {
  await assertAIActive(memberId);
  const recentStart = addDaysKey(start, -14);
  const [profile, member, latestMetric, recentPlans] = await Promise.all([
    prisma.aIProfile.findUnique({ where: { memberId } }),
    prisma.member.findUnique({ where: { id: memberId }, include: { user: true } }),
    prisma.bodyMetric.findFirst({ where: { memberId }, orderBy: { recordedAt: 'desc' } }),
    prisma.dailyPlan.findMany({ where: { memberId, source: 'AI', dateKey: { gte: recentStart, lt: start } }, include: { exercises: true } })
  ]);
  if (!profile) throw new AppError(409, 'Complete AI Coach onboarding first.');
  if (!member?.age || !member?.heightCm || !member?.weightKg || !member?.bodyType) {
    throw new AppError(409, 'Complete age, height, weight and body type in Profile before generating an AI plan.');
  }
  const effectiveProfile = {
    ...profile,
    age: member.age,
    heightCm: member.heightCm,
    weightKg: latestMetric?.weightKg || member.weightKg
  };
  const goal = normalizeGoal(member.goal || 'FITNESS');
  const targets = nutrition(effectiveProfile, goal);
  const templates = workouts[goal] || workouts.FITNESS;
  const completedRecent = recentPlans.filter(p => p.dayType === 'TRAINING' && p.exercises.length && p.exercises.every(e => e.status === 'COMPLETED')).length;
  const scheduledRecent = recentPlans.filter(p => p.dayType === 'TRAINING').length;
  const adherence = scheduledRecent ? Math.round(completedRecent / scheduledRecent * 100) : null;
  const volumeDelta = adherence != null && adherence >= 85 ? 1 : adherence != null && adherence < 60 ? -1 : 0;
  const effectiveTrainingDays = effectiveProfile.sleepHours && effectiveProfile.sleepHours < 6 ? Math.min(effectiveProfile.trainingDays, 4) : effectiveProfile.trainingDays;
  const days = trainingIndexes(effectiveTrainingDays);
  let workoutCursor = 0;

  for (let offset = 0; offset < 7; offset++) {
    const key = addDaysKey(start, offset);
    const training = days.includes(offset);
    const template = templates[workoutCursor % templates.length];
    if (training) workoutCursor += 1;
    const meals = mealTemplates(effectiveProfile, targets);
    const adapted = adaptExercises(template.items, effectiveProfile, volumeDelta);
    const exercises = training ? adapted.map((it, index) => ({
      exerciseName: it[0], muscleGroup: it[1], sets: Number(it[2]), reps: String(it[3]), restSeconds: effectiveProfile.experience === 'ADVANCED' ? 120 : 90, position: index
    })) : [];
    const data = {
      memberId,
      trainerId: null,
      dateKey: key,
      source: 'AI',
      dayType: training ? 'TRAINING' : 'REST',
      title: training ? template.title : 'Recovery Day',
      notes: training ? `Adaptive ${goal.toLowerCase().replace('_',' ')} session. Stop if you feel pain or unusual symptoms.` : 'No strength session today. Prioritize easy movement, hydration and sleep.',
      generatedReason: `AI Coach V1: goal=${goal}, ${effectiveTrainingDays} training days/week, ${effectiveProfile.sessionMinutes} min/session, ${effectiveProfile.experience.toLowerCase()} level, ${effectiveProfile.equipmentAccess.toLowerCase()} equipment${effectiveProfile.sleepHours && effectiveProfile.sleepHours < 6 ? ', reduced training frequency due to low reported sleep' : ''}${adherence != null ? `, recent workout adherence ${adherence}%` : ''}${volumeDelta > 0 ? ', volume progressed' : volumeDelta < 0 ? ', volume reduced for consistency' : ''}.`,
      calorieTarget: targets.calories,
      proteinTarget: targets.protein,
      carbsTarget: targets.carbs,
      fatTarget: targets.fat,
      waterMlTarget: targets.waterMl,
      stepsTarget: targets.steps
    };
    const existing = await prisma.dailyPlan.findUnique({ where: { memberId_dateKey: { memberId, dateKey: key } } });
    if (existing && existing.source === 'TRAINER') continue;
    if (existing) {
      await prisma.dailyPlan.update({
        where: { id: existing.id },
        data: {
          ...data,
          exercises: { deleteMany: {}, create: exercises },
          meals: { deleteMany: {}, create: meals }
        }
      });
    } else {
      await prisma.dailyPlan.create({ data: { ...data, exercises: { create: exercises }, meals: { create: meals } } });
    }
  }
  publishEvent('plan-updated', { memberId });
  return { ok: true, start, days: 7, engine: 'rules' };
}

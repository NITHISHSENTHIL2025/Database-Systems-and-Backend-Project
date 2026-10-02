import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Notice, PageHeader, Panel, Spinner, Stat } from '../../components/UI.jsx';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
const blankExercise=()=>({exerciseName:'',sets:3,reps:'10'});
const blankMeal=(name,time)=>({name,timeLabel:time,items:'',calories:'',protein:''});

export default function TrainerClientPage(){
  const {memberId}=useParams();
  const {data,error,loading,reload}=useApiData(`/trainer/clients/${memberId}`);
  const [form,setForm]=useState({dateKey:todayKey(),dayType:'TRAINING',title:'Today’s workout',notes:'',exercises:[blankExercise(),blankExercise(),blankExercise()],meals:[blankMeal('Breakfast','08:00'),blankMeal('Lunch','13:00'),blankMeal('Snack','17:00'),blankMeal('Dinner','20:30')]});
  const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!data)return;
    const plan=data.plans?.find(p=>p.dateKey===todayKey());
    if(plan){
      setForm({
        dateKey:plan.dateKey,dayType:plan.dayType,title:plan.title,notes:plan.notes||'',
        exercises:plan.exercises?.length?plan.exercises.map(e=>({exerciseName:e.exerciseName,sets:e.sets,reps:e.reps})): [blankExercise()],
        meals:plan.meals?.length?plan.meals.map(m=>({name:m.name,timeLabel:m.timeLabel||'',items:Array.isArray(m.items)?m.items.join(', '):'',calories:m.calories??'',protein:m.protein??''})):[blankMeal('Breakfast','08:00'),blankMeal('Lunch','13:00'),blankMeal('Dinner','20:30')]
      });
    }
  },[data]);

  if(loading)return <Spinner label="Loading member"/>;
  if(error)return <Notice type="error">{error}</Notice>;
  const latestWeight=data.metrics?.[0]?.weightKg || '—';

  function exChange(i,key,value){setForm(f=>({...f,exercises:f.exercises.map((x,n)=>n===i?{...x,[key]:value}:x)}))}
  function mealChange(i,key,value){setForm(f=>({...f,meals:f.meals.map((x,n)=>n===i?{...x,[key]:value}:x)}))}
  async function save(e){
    e.preventDefault(); setBusy(true); setMessage('');
    try{
      const payload={
        dateKey:form.dateKey,dayType:form.dayType,title:form.dayType==='REST'?'Recovery day':form.title,notes:form.notes||null,
        calorieTarget:null,proteinTarget:null,carbsTarget:null,fatTarget:null,waterMlTarget:2500,stepsTarget:8000,
        exercises:form.dayType==='REST'?[]:form.exercises.filter(x=>x.exerciseName.trim()).map(x=>({exerciseName:x.exerciseName.trim(),sets:Number(x.sets)||3,reps:String(x.reps||'10'),muscleGroup:null,targetWeightKg:null,restSeconds:90,notes:null})),
        meals:form.meals.filter(x=>x.name.trim()&&x.items.trim()).map(x=>({name:x.name.trim(),timeLabel:x.timeLabel||null,items:x.items.split(',').map(s=>s.trim()).filter(Boolean),calories:x.calories===''?null:Number(x.calories),protein:x.protein===''?null:Number(x.protein),carbs:null,fat:null}))
      };
      await api(`/trainer/clients/${memberId}/daily-plan`,json('PUT',payload));
      setMessage('Today’s plan saved. The member can see it now.'); await reload();
    }catch(err){setMessage(err.message)}finally{setBusy(false)}
  }

  return <>
    <PageHeader eyebrow="MEMBER" title={data.member.name} copy={`${data.member.goal||'No goal set'} · ${data.membership?.name||'No active membership'}`}/>
    {message&&<Notice type={message.includes('saved')?'success':'error'}>{message}</Notice>}
    <div className="stats-grid"><Stat label="Weight" value={latestWeight==='—'?'—':`${latestWeight} kg`}/><Stat label="Attendance (28d)" value={data.attendance?.length||0}/><Stat label="Plan" value={data.membership?.name||'—'}/></div>

    <form onSubmit={save} className="trainer-simple-plan">
      <Panel title="Today’s plan" copy="Set today as a training or recovery day, then add the member’s workout and diet.">
        <div className="form-grid two">
          <label>Day type<select value={form.dayType} onChange={e=>setForm({...form,dayType:e.target.value})}><option value="TRAINING">Training day</option><option value="REST">Rest day</option></select></label>
          {form.dayType==='TRAINING'&&<label>Workout title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>}
        </div>
        <label>Coach note<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Short note for today"/></label>
      </Panel>

      {form.dayType==='TRAINING'&&<Panel title="Workout">
        <div className="simple-plan-list">{form.exercises.map((ex,i)=><div className="simple-plan-row" key={i}><input placeholder="Exercise" value={ex.exerciseName} onChange={e=>exChange(i,'exerciseName',e.target.value)}/><input type="number" min="1" max="10" value={ex.sets} onChange={e=>exChange(i,'sets',e.target.value)}/><input placeholder="Reps" value={ex.reps} onChange={e=>exChange(i,'reps',e.target.value)}/><button type="button" className="inline-button" onClick={()=>setForm(f=>({...f,exercises:f.exercises.filter((_,n)=>n!==i)}))}>Remove</button></div>)}</div>
        <button type="button" className="button button-ghost-dark" onClick={()=>setForm(f=>({...f,exercises:[...f.exercises,blankExercise()]}))}>+ Exercise</button>
      </Panel>}

      <Panel title="Diet">
        <div className="simple-meal-list">{form.meals.map((meal,i)=><div className="simple-meal-row" key={i}><input placeholder="Meal" value={meal.name} onChange={e=>mealChange(i,'name',e.target.value)}/><input placeholder="Time" value={meal.timeLabel} onChange={e=>mealChange(i,'timeLabel',e.target.value)}/><input className="wide" placeholder="Foods, separated by comma" value={meal.items} onChange={e=>mealChange(i,'items',e.target.value)}/><input type="number" placeholder="kcal" value={meal.calories} onChange={e=>mealChange(i,'calories',e.target.value)}/><input type="number" placeholder="protein g" value={meal.protein} onChange={e=>mealChange(i,'protein',e.target.value)}/></div>)}</div>
      </Panel>
      <button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save today’s plan'}</button>
    </form>
  </>;
}

import React from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, PageHeader, Panel, Spinner } from '../../components/UI.jsx';

export default function TrainerClientsPage(){
  const {data,error,loading}=useApiData('/trainer/clients');
  if(loading) return <Spinner label="Loading clients"/>;
  if(error) return <Notice type="error">{error}</Notice>;
  return <><PageHeader eyebrow="CLIENTS" title="Coach the person, not the spreadsheet." copy="Open a client to publish daily workout, diet, recovery and progress updates."/>
  <Panel>{data.length?<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Goal</th><th>Membership</th><th>Weight</th><th>Assigned</th><th></th></tr></thead><tbody>{data.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.email}<br/>{c.phone||'No phone'}</small></td><td>{c.goal||'—'}</td><td>{c.membership||'—'}</td><td>{c.weight?`${c.weight} kg`:'—'}</td><td>{new Date(c.assignedAt).toLocaleDateString()}</td><td><Link className="inline-button" to={`/trainer/clients/${c.id}`}>Open →</Link></td></tr>)}</tbody></table></div>:<Empty title="No assigned clients"/>}</Panel></>;
}

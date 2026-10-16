import {forecast,type Context} from './planning';
import type sample from '../data/dashboard.json';
export type Dashboard=typeof sample;
export type DailyRecord={date:string;rows:Dashboard['recent'];context?:Context};
export type Settings={name:string;products:{id:number;name:string;unit:number}[]};
export function dashboardFromRecords(base:Dashboard,records:DailyRecord[],settings:Settings|null,date?:string):Dashboard {
 const record=date?records.find(r=>r.date===date):[...records].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const storeName=settings?.name||base.storeName;
 if(!record)return {...base,storeName,recent:base.recent.map(r=>({...r,name:settings?.products.find(p=>p.id===r.id)?.name||r.name}))};
 const next=new Date(record.date+'T12:00:00');next.setDate(next.getDate()+1);const nextDate=next.toLocaleDateString('en-CA');
 const recent=record.rows.map(r=>{const p=settings?.products.find(p=>p.id===r.id);const unit=p?.unit||5;const plan=record.context?forecast(records,r.id,nextDate,record.context,unit):null;return {...r,name:p?.name||r.name,planned:plan?.quantity??0,reason:plan?.reason||'학기·학사일정·운영시간 기록 필요',status:plan?.quantity==null?'자료 부족':'조건별 제안'}});
 const totals=recent.reduce((t,r)=>({produced:t.produced+r.produced,sold:t.sold+r.sold,waste:t.waste+r.waste,remaining:t.remaining+r.remaining}),{produced:0,sold:0,waste:0,remaining:0});
 return {...base,storeName,date:record.date,isMock:false,totals,recent};
}

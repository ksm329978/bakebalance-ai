import type {DailyRecord} from './dashboard-records';
export type Context={semester:string,event:string,team:string,hours:number};
export type DemandRow={id:number;name:string;sold:number;produced:number;waste:number;remaining:number;missed?:number;stockoutTime?:string};
export type RichRecord=DailyRecord & {context?:Context};
export function forecast(records:RichRecord[],id:number,date:string,context:Context,unit:number,reserved=0){
 if(context.hours<=0||!context.semester.trim())return {quantity:null,count:0,low:null,high:null,reason:'계획 운영시간과 학기를 확인하세요',confidence:'자료 부족',stockouts:0};
 const weekday=(s:string)=>new Date(s+'T12:00:00').getDay();
 const eligible=records.filter(r=>r.date<date&&r.context?.semester===context.semester&&r.context?.event===context.event&&r.context.hours>0);
 const same=eligible.filter(r=>weekday(r.date)===weekday(date));const candidates=(same.length?same:eligible).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
 const observations=candidates.map(r=>({record:r,row:r.rows.find(x=>x.id===id) as DemandRow|undefined})).filter(x=>x.row);
 if(!observations.length)return {quantity:null,count:0,low:null,high:null,reason:'같은 학기·학사일정의 비교 기록 없음',confidence:'자료 부족',stockouts:0};
 const estimates=observations.map(({record,row})=>((row!.sold+(row!.missed||0))/record.context!.hours)*context.hours);
 const mean=estimates.reduce((s,n)=>s+n,0)/estimates.length;const total=Math.max(mean,reserved);const round=(n:number)=>Math.ceil(n/Math.max(1,unit))*Math.max(1,unit);
 return {quantity:round(total),count:estimates.length,low:round(Math.min(...estimates)),high:round(Math.max(...estimates,reserved)),reason:`${same.length?'같은 요일':'요일 자료 부족 → 같은 학사일정'} ${estimates.length}일 · 운영시간 보정 · 확인된 미충족 주문 가산 · 예약은 최소량`,confidence:estimates.length>=4?'비교 기록 4일 이상':'잠정: 비교 기록 4일 미만',stockouts:observations.filter(x=>x.row!.stockoutTime).length};
}
export function order(input:{stock:number;excluded:number;incoming:number;allocated:number;daily:number;lead:number;safety:number;period:number;quantity:number;pack:number;mode:string;planned:number}){
 const usable=Math.max(0,input.stock-input.excluded);const position=usable+input.incoming-input.allocated;const point=input.daily*input.lead+input.safety;const target=Math.max(input.daily*(input.lead+input.period)+input.safety,input.planned);const deficit=Math.max(0,target-position);const round=(n:number)=>Math.ceil(n/Math.max(1,input.pack))*Math.max(1,input.pack);
 const qty=input.mode==='정량발주'?(position<=point||position<input.planned?round(Math.ceil(Math.max(0,Math.max(point,input.planned)-position)/Math.max(1,input.quantity))*Math.max(1,input.quantity)||input.quantity):0):round(deficit);
 return {usable,position,point,target,quantity:qty};
}

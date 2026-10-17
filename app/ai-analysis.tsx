'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Dashboard} from '../lib/dashboard-records';
type Result={analysis:string;model:string;source:string;date:string;analyzedAt:string};
export default function AIAnalysis({data}:{data:Dashboard}){
 const [source,setSource]=useState('mock');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<Result|null>(null);
 const fingerprint=JSON.stringify(data);const controller=useRef<AbortController|null>(null);
 useEffect(()=>{controller.current?.abort();setBusy(false);setResult(null);setError('');return()=>controller.current?.abort()},[fingerprint,source]);
 async function analyze(){
  if(busy)return;setBusy(true);setError('');setResult(null);const abort=new AbortController();controller.current=abort;
  try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,dashboard:source==='dashboard'?data:undefined}),signal:abort.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||'분석 요청에 실패했습니다.');if(!abort.signal.aborted)setResult(body)}catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'연결을 확인해 주세요.')}finally{if(!abort.signal.aborted)setBusy(false)}
 }
 return <section className="ai-panel" aria-labelledby="ai-title"><div className="ai-top"><div><div className="eyebrow">GEMINI AI INSIGHTS</div><h2 id="ai-title"><Sparkles size={21}/> AI 운영 분석</h2><p>생산·판매·폐기·잔량 데이터를 Gemini에 보내 운영 개선점을 분석합니다.</p></div><span className="pill">버튼을 누를 때 분석</span></div><div className="ai-controls"><label>분석할 자료<select value={source} disabled={busy} onChange={e=>setSource(e.target.value)}><option value="mock">수업 실습용 MOCK 데이터</option><option value="dashboard">현재 대시보드 데이터{data.isMock?' (예시)':''}</option></select></label><button className="primary-btn" disabled={busy} onClick={analyze}>{busy?'AI가 분석하는 중…':'AI 분석하기'}</button></div><p className="ai-note">{source==='mock'?'실습용 가상 데이터 5종을 분석합니다. 실제 매장 실적이 아닙니다.':`${data.date} · ${data.isMock?'예시 데이터':'현재 브라우저에 저장한 기록'}를 분석합니다.`} 분석은 참고용이며 생산·발주 수량은 담당자가 검토합니다.</p><div aria-live="polite" aria-busy={busy}>{busy&&<p role="status">Gemini에 분석을 요청했습니다. 잠시 기다려 주세요.</p>}{error&&<p role="alert" className="ai-error">{error}</p>}{result&&<div className="ai-result"><b>Gemini AI 분석 결과</b><p className="ai-meta">{result.source} · {result.date} · {result.model}<br/>분석 시각 {new Date(result.analyzedAt).toLocaleString('ko-KR')}</p><div className="ai-text">{result.analysis}</div></div>}{!busy&&!error&&!result&&<div className="ai-empty">자료를 선택하고 ‘AI 분석하기’를 누르면 여기에 실제 API 응답이 표시됩니다.</div>}</div></section>
}

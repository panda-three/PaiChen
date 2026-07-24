"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function CustomerAccess({ storeSlug, refCode, initialMode }: { storeSlug:string; refCode:string; initialMode:string }) {
  const [mode,setMode]=useState(initialMode); const [message,setMessage]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setMessage("");const data=new FormData(event.currentTarget);
    if(mode==="login"){const result=await signIn("credentials",{username:data.get("phone"),password:data.get("password"),redirect:false});if(result?.error){setMessage("账号未激活，或手机号/密码不正确");return;}if(storeSlug&&refCode){await fetch("/api/customer/attribution",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeSlug,ref:refCode,sessionId:sessionStorage.getItem("yc-session")||undefined})});}window.location.href="/me";return;}
    const endpoint=mode==="forgot"?"/api/customer/forgot":"/api/customer/register";const body=mode==="forgot"?{storeSlug,phone:data.get("phone"),newPassword:data.get("password")}:{storeSlug,ref:refCode||null,name:data.get("name"),phone:data.get("phone"),password:data.get("password")};const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();setMessage(result.error??`${result.message}${result.resetCode?`，申请码：${result.resetCode}`:""}`);
  }
  return <><div className="mt-5 flex gap-2">{[["login","登录"],["register","注册"],["forgot","忘记密码"]].map(([key,label])=><button key={key} className={`btn ${mode===key?"btn-primary":""}`} onClick={()=>setMode(key)}>{label}</button>)}</div><form onSubmit={submit} className="mt-5 grid gap-3">{mode==="register"&&<input className="field" name="name" placeholder="姓名" required/>}<input className="field" name="phone" placeholder="手机号" pattern="1[0-9]{10}" required/><input className="field" name="password" type="password" minLength={8} placeholder={mode==="forgot"?"申请启用的新密码":"密码（至少 8 位）"} required/>{mode!=="login"&&!storeSlug&&<p className="text-sm text-red-700">请从具体店铺页面进入注册或找回密码。</p>}<button className="btn btn-primary" disabled={mode!=="login"&&!storeSlug}>{mode==="login"?"登录":"提交人工审核"}</button>{message&&<p className="rounded bg-[#f5f2ec] p-3 text-sm">{message}</p>}</form></>;
}

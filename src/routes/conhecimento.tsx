import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Eye, Pencil, Plus, Search, Trash2, X, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getMyPermissions, listKnowledgeArticles, createKnowledgeArticle, updateKnowledgeArticle, deleteKnowledgeArticle } from "@/lib/supabase/repositories";
import { toast } from "sonner";

export const Route = createFileRoute("/conhecimento")({ component: ConhecimentoPage });

type Article = {
  id:string; title:string; slug:string; category?:string|null; summary?:string|null;
  content:string; tags:string[]; is_published:boolean; views:number; created_at:string; updated_at:string;
};

function ConhecimentoPage() {
  const [articles,setArticles]=useState<Article[]>([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [selected,setSelected]=useState<Article|null>(null);
  const [editing,setEditing]=useState<Article|null>(null);
  const [creating,setCreating]=useState(false);
  const [canManage,setCanManage]=useState(false);
  const [loading,setLoading]=useState(true);

  const load=async()=>{
    try{
      setLoading(true);
      const [rows, permissions]=await Promise.all([listKnowledgeArticles(),getMyPermissions()]);
      setArticles(rows??[]);
      setCanManage(permissions.includes("knowledge.manage"));
    }catch(e:any){
      toast.error(e?.message??"Não foi possível carregar a base de conhecimento.");
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const categories=useMemo(()=>Array.from(new Set(articles.map(a=>a.category).filter(Boolean) as string[])).sort(),[articles]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return articles.filter(a=>
      (category==="all"||a.category===category)&&
      (!q||[a.title,a.summary,a.content,(a.tags??[]).join(" "),a.category??""].join(" ").toLowerCase().includes(q))
    );
  },[articles,category,query]);

  const empty=()=>({id:"",title:"",category:"",summary:"",content:"",tags:[],is_published:true,views:0,slug:"",created_at:"",updated_at:""} as Article);

  return <AppShell title="Base de conhecimento" subtitle="Centralize procedimentos, soluções e documentação técnica reutilizável.">
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar artigos, procedimentos e soluções..."/>
            </div>
            <select value={category} onChange={e=>setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="all">Todas as categorias</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {canManage&&<Button onClick={()=>setCreating(true)}><Plus className="mr-2 h-4 w-4"/>Novo artigo</Button>}
        </div>
      </Card>

      {loading ? <Card className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Carregando base de conhecimento...</Card> :
      filtered.length===0 ? <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-6 w-6"/></div><h2 className="text-lg font-semibold">Nenhum artigo encontrado</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Cadastre procedimentos e soluções para facilitar o atendimento de chamados.</p></Card> :
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map(a=><Card key={a.id} className="overflow-hidden">
          <button type="button" onClick={()=>setSelected(a)} className="w-full p-5 text-left transition-colors hover:bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{a.category??"Procedimento"}</div><h2 className="mt-1 truncate text-base font-semibold">{a.title}</h2></div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="h-3.5 w-3.5"/>{a.views}</div>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.summary??a.content}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{(a.tags??[]).slice(0,5).map(t=><span key={t} className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{t}</span>)}</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground"><span>{a.is_published?"Publicado":"Rascunho"}</span><span>•</span><span>Atualizado {new Date(a.updated_at).toLocaleDateString("pt-BR")}</span></div>
          </button>
          {canManage&&<div className="flex justify-end gap-1 border-t px-3 py-2"><Button variant="ghost" size="sm" onClick={()=>setEditing(a)}><Pencil className="mr-2 h-3.5 w-3.5"/>Editar</Button><Button variant="ghost" size="sm" className="text-red-600" onClick={async()=>{if(!window.confirm("Excluir este artigo?"))return;try{await deleteKnowledgeArticle(a.id);toast.success("Artigo excluído.");await load();}catch(e:any){toast.error(e?.message??"Não foi possível excluir o artigo.");}}}><Trash2 className="mr-2 h-3.5 w-3.5"/>Excluir</Button></div>}
        </Card>)}
      </div>}
    </div>

    {(creating||editing||selected)&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      {selected?<ArticleViewer article={selected} onClose={()=>setSelected(null)}/>:
      <ArticleEditor article={editing??empty()} onClose={()=>{setCreating(false);setEditing(null);}} onSaved={()=>{setCreating(false);setEditing(null);void load();}}/>
      }
    </div>}
  </AppShell>;
}

function ArticleViewer({article,onClose}:{article:Article;onClose:()=>void}) {
  return <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
    <div className="flex items-start justify-between gap-4 border-b p-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{article.category??"Procedimento"}</div><h2 className="mt-1 text-xl font-semibold">{article.title}</h2><p className="mt-1 text-sm text-muted-foreground">{article.summary??""}</p></div><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="overflow-y-auto p-5"><div className="whitespace-pre-wrap text-sm leading-7">{article.content}</div>{article.tags?.length>0&&<div className="mt-6 flex flex-wrap gap-1.5">{article.tags.map(t=><span key={t} className="rounded-full bg-muted px-2 py-1 text-[10px]">{t}</span>)}</div>}</div>
  </Card>;
}

function ArticleEditor({article,onClose,onSaved}:{article:Article;onClose:()=>void;onSaved:()=>void}) {
  const isEdit=Boolean(article.id);
  const [form,setForm]=useState({title:article.title,category:article.category??"",summary:article.summary??"",content:article.content,tags:(article.tags??[]).join(", "),isPublished:article.is_published});
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    if(form.title.trim().length<3||form.content.trim().length<10){toast.error("Informe título e conteúdo do artigo.");return;}
    setSaving(true);
    try{
      const payload={title:form.title,category:form.category,summary:form.summary,content:form.content,tags:form.tags.split(",").map(x=>x.trim()).filter(Boolean),isPublished:form.isPublished};
      if(isEdit) await updateKnowledgeArticle({id:article.id,...payload}); else await createKnowledgeArticle(payload);
      toast.success(isEdit?"Artigo atualizado.":"Artigo criado.");
      onSaved();
    }catch(e:any){toast.error(e?.message??"Não foi possível salvar o artigo.");}finally{setSaving(false);}
  };
  return <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-6">
    <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">{isEdit?"Editar artigo":"Novo artigo"}</h2><p className="text-sm text-muted-foreground">Registre procedimentos, soluções e boas práticas.</p></div><Button variant="ghost" size="icon" onClick={onClose} disabled={saving}><X/></Button></div>
    <div className="space-y-4">
      <div><label className="text-xs font-medium">Título *</label><Input className="mt-1.5" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-medium">Categoria</label><Input className="mt-1.5" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ex.: Rede, Windows, ERP"/></div><div><label className="text-xs font-medium">Tags</label><Input className="mt-1.5" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="rede, dns, diagnóstico"/></div></div>
      <div><label className="text-xs font-medium">Resumo</label><Textarea className="mt-1.5" rows={3} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></div>
      <div><label className="text-xs font-medium">Conteúdo *</label><Textarea className="mt-1.5 min-h-[260px]" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></div>
      <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="text-sm font-medium">Publicado</div><div className="text-xs text-muted-foreground">Artigos não publicados ficam visíveis apenas para o administrador.</div></div><Switch checked={form.isPublished} onCheckedChange={v=>setForm({...form,isPublished:v})}/></div>
    </div>
    <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={()=>void save()} disabled={saving}>{saving?<><CheckCircle2 className="mr-2 h-4 w-4 animate-pulse"/>Salvando...</>:"Salvar artigo"}</Button></div>
  </Card>;
}

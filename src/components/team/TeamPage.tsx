"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField, FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { addMeetingAction, addStaffPost, commentStaffPost, createMeeting, toggleMeetingAction, togglePinPost, updateMeetingReport, validateMeetingReport } from "@/lib/services/teamService";
import { useState } from "react";

/** Espace d'échange du personnel : messages, informations importantes, réunions et suivi d'actions. */
export default function TeamPage() {
  const { db, run, user } = useDemo();
  const opts = useOptions();
  const [tab, setTab] = useState("posts");
  const postModal = useModal();
  const meetingModal = useModal();
  const [post, setPost] = useState({ text: "", pinned: false, missionId: "" });
  const [meeting, setMeeting] = useState({ title: "", date: "", attendeeIds: [] as string[], report: "" });
  const [comment, setComment] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Record<string, { label: string; assigneeId: string; dueDate: string }>>({});
  const [reportEdit, setReportEdit] = useState<Record<string, string>>({});
  const [confirmValidate, setConfirmValidate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const posts = [...db.staffPosts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Espace équipe"
        subtitle="Échanges internes, informations importantes, réunions et suivi des actions"
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => { setMeeting({ title: "", date: "", attendeeIds: [], report: "" }); meetingModal.openModal(); }}>Réunion</Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => { setPost({ text: "", pinned: false, missionId: "" }); postModal.openModal(); }}>Message</Button>
          </>
        }
      />
      <Tabs active={tab} onChange={setTab} tabs={[{ key: "posts", label: "Messages et informations", count: posts.length }, { key: "meetings", label: "Réunions et comptes rendus", count: db.meetings.length }]} />

      {tab === "posts" && (
        <div className="mx-auto max-w-3xl space-y-3">
          {posts.map((p) => (
            <div key={p.id} className={`rounded-2xl border bg-white p-4 dark:bg-gray-900 ${p.pinned ? "border-brand-200 dark:border-brand-800" : "border-gray-100 dark:border-gray-800"}`}>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 font-semibold text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-400">{userName(db, p.authorId).slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{userName(db, p.authorId)}</span>
                    <span className="text-theme-xs text-gray-400">{formatDateTime(p.date)}</span>
                    {p.pinned && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">Information épinglée</span>}
                    {p.missionId && <Link href={`/missions/${p.missionId}`} className="text-theme-xs text-brand-600 hover:underline">Mission liée →</Link>}
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{p.text}</p>
                  {p.comments.map((c) => (
                    <div key={c.id} className="mt-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/3">
                      <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">{userName(db, c.authorId)}</span>
                      <span className="ms-2 text-[11px] text-gray-400">{formatDateTime(c.date)}</span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{c.text}</p>
                    </div>
                  ))}
                  <form
                    className="mt-2 flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (run(commentStaffPost, { postId: p.id, text: comment[p.id] ?? "" }).ok) setComment({ ...comment, [p.id]: "" });
                    }}
                  >
                    <input value={comment[p.id] ?? ""} onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })} placeholder="Commenter…" className="h-8 flex-1 rounded-lg border border-gray-200 bg-transparent px-2.5 text-sm dark:border-gray-700" />
                    {(user?.roleId === "dg" || p.pinned) && (
                      <button type="button" onClick={() => run(togglePinPost, { postId: p.id })} className="text-theme-xs text-gray-400 hover:text-brand-600">{p.pinned ? "Désépingler" : "Épingler"}</button>
                    )}
                  </form>
                </div>
              </div>
            </div>
          ))}
          {!posts.length && <p className="text-center text-sm text-gray-500">Aucun message — publiez la première information d&apos;équipe.</p>}
        </div>
      )}

      {tab === "meetings" && (
        <div className="space-y-4">
          {db.meetings.map((m) => (
            <ComponentCard
              key={m.id}
              title={`${m.code} — ${m.title}`}
              desc={`${formatDate(m.date)} · ${m.attendeeIds.map((a) => userName(db, a)).join(", ")}`}
              actions={
                <span className="flex items-center gap-2">
                  {m.reportValidated ? <span className="rounded-full bg-success-50 px-2.5 py-1 text-theme-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400">CR validé</span> : <span className="rounded-full bg-warning-50 px-2.5 py-1 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">CR à valider</span>}
                  <Button size="xs" variant="outline" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>{expanded === m.id ? "Réduire" : "Détail"}</Button>
                </span>
              }
            >
              {(expanded === m.id ? true : m.report) && (
                <>
                  {expanded === m.id ? (
                    <div className="space-y-3">
                      <TextAreaField label="Compte rendu (modifiable — validé avant diffusion)" value={reportEdit[m.id] ?? m.report} onChange={(x) => setReportEdit({ ...reportEdit, [m.id]: x })} rows={4} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => run(updateMeetingReport, { id: m.id, report: reportEdit[m.id] ?? m.report })}>Enregistrer le CR</Button>
                        {!m.reportValidated && <Button size="sm" onClick={() => setConfirmValidate(m.id)}>Valider le compte rendu</Button>}
                      </div>
                      <div>
                        <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Actions à mener</p>
                        <ul className="space-y-1.5 text-sm">
                          {m.actionItems.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-2">
                              <input type="checkbox" checked={a.done} onChange={() => run(toggleMeetingAction, { id: m.id, actionId: a.id })} className="size-4 rounded border-gray-300 accent-brand-500" />
                              <span className={a.done ? "text-gray-400 line-through" : ""}>{a.label}</span>
                              <span className="ms-auto text-theme-xs text-gray-500">{a.assigneeId ? userName(db, a.assigneeId) : "Non assigné"}{a.dueDate ? ` · ${formatDate(a.dueDate)}` : ""}</span>
                            </li>
                          ))}
                          {!m.actionItems.length && <li className="text-gray-500">Aucune action.</li>}
                        </ul>
                        <form
                          className="mt-2 grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_10rem_9rem_auto]"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const a = action[m.id] ?? { label: "", assigneeId: "", dueDate: "" };
                            if (run(addMeetingAction, { id: m.id, ...a, assigneeId: a.assigneeId || undefined, dueDate: a.dueDate || undefined }).ok) setAction({ ...action, [m.id]: { label: "", assigneeId: "", dueDate: "" } });
                          }}
                        >
                          <input value={action[m.id]?.label ?? ""} onChange={(e) => setAction({ ...action, [m.id]: { ...(action[m.id] ?? { label: "", assigneeId: "", dueDate: "" }), label: e.target.value } })} placeholder="Nouvelle action…" className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700" />
                          <select value={action[m.id]?.assigneeId ?? ""} onChange={(e) => setAction({ ...action, [m.id]: { ...(action[m.id] ?? { label: "", assigneeId: "", dueDate: "" }), assigneeId: e.target.value } })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                            <option value="">Responsable…</option>
                            {db.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                          <input type="date" value={action[m.id]?.dueDate ?? ""} onChange={(e) => setAction({ ...action, [m.id]: { ...(action[m.id] ?? { label: "", assigneeId: "", dueDate: "" }), dueDate: e.target.value } })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700" />
                          <Button size="sm" type="submit">Ajouter</Button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <p className="line-clamp-3 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{m.report}</p>
                  )}
                </>
              )}
            </ComponentCard>
          ))}
          {!db.meetings.length && <p className="text-sm text-gray-500">Aucune réunion enregistrée.</p>}
        </div>
      )}

      <ModalPost isOpen={postModal.isOpen} onClose={postModal.closeModal} post={post} setPost={setPost} missions={db.missions.map((m) => ({ value: m.id, label: `${m.code} — ${m.objective}` }))} onSave={() => { if (run(addStaffPost, { ...post, missionId: post.missionId || undefined }).ok) { postModal.closeModal(); } }} />
      <ModalMeeting isOpen={meetingModal.isOpen} onClose={meetingModal.closeModal} meeting={meeting} setMeeting={setMeeting} users={opts.staff} onSave={() => { if (run(createMeeting, meeting).ok) meetingModal.closeModal(); }} />
      <ConfirmDialog isOpen={!!confirmValidate} onClose={() => setConfirmValidate(null)} title="Valider le compte rendu" message="Le compte rendu sera marqué comme validé et traçable dans le journal." onConfirm={() => (confirmValidate ? run(validateMeetingReport, { id: confirmValidate }).ok : false)} />
    </div>
  );
}

function ModalPost({ isOpen, onClose, post, setPost, missions, onSave }: { isOpen: boolean; onClose: () => void; post: { text: string; pinned: boolean; missionId: string }; setPost: (v: { text: string; pinned: boolean; missionId: string }) => void; missions: { value: string; label: string }[]; onSave: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Publier un message</h3>
      <FormGrid>
        <TextAreaField label="Message" required value={post.text} onChange={(text) => setPost({ ...post, text })} rows={3} className="sm:col-span-2" placeholder="Information utile à l'équipe…" />
        <SelectField label="Mission liée (optionnel)" value={post.missionId} onChange={(missionId) => setPost({ ...post, missionId })} options={missions} allowEmpty placeholder="Aucune" />
        <div className="flex items-end"><CheckField label="Épingler comme information importante" checked={post.pinned} onChange={(pinned) => setPost({ ...post, pinned })} /></div>
      </FormGrid>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button disabled={!post.text.trim()} onClick={onSave}>Publier</Button>
      </div>
    </Modal>
  );
}

function ModalMeeting({ isOpen, onClose, meeting, setMeeting, users, onSave }: { isOpen: boolean; onClose: () => void; meeting: { title: string; date: string; attendeeIds: string[]; report: string }; setMeeting: (v: { title: string; date: string; attendeeIds: string[]; report: string }) => void; users: { value: string; label: string }[]; onSave: () => void }) {
  const toggle = (id: string) => setMeeting({ ...meeting, attendeeIds: meeting.attendeeIds.includes(id) ? meeting.attendeeIds.filter((x) => x !== id) : [...meeting.attendeeIds, id] });
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Enregistrer une réunion</h3>
      <FormGrid>
        <TextField label="Titre" required value={meeting.title} onChange={(title) => setMeeting({ ...meeting, title })} className="sm:col-span-2" />
        <TextField label="Date et heure" type="datetime-local" required value={meeting.date} onChange={(date) => setMeeting({ ...meeting, date })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Participants</p>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <button key={u.value} type="button" onClick={() => toggle(u.value)} className={`rounded-full border px-3 py-1 text-sm ${meeting.attendeeIds.includes(u.value) ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400"}`}>{u.label}</button>
            ))}
          </div>
        </div>
        <TextAreaField label="Compte rendu (à valider avant diffusion)" value={meeting.report} onChange={(report) => setMeeting({ ...meeting, report })} rows={4} className="sm:col-span-2" />
      </FormGrid>
      <p className="mt-2 text-theme-xs text-gray-400">La transcription audio d&apos;une réunion nécessitera le service de transcription externe (consentement des participants requis) — non activée en démonstration.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button disabled={!meeting.title.trim() || !meeting.attendeeIds.length} onClick={onSave}>Enregistrer</Button>
      </div>
    </Modal>
  );
}

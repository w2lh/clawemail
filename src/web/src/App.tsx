import { useEffect, useMemo, useState } from "react";
import {
  createEventSource,
  createMailbox,
  deleteMailbox,
  disconnectClaw,
  fetchClawAuthStatus,
  fetchMail,
  fetchMailboxes,
  fetchMails,
  getAdminPassword,
  refreshClawConnection,
  replyMail,
  sendMail,
  sendClawLoginCode,
  setAdminPassword,
  verifyClawLoginCode,
  type ClawAuthStatus,
  type MailDetail,
  type MailSummary,
  type Mailbox
} from "./api";

type View = "mailboxes" | "inbox";

function splitRecipients(value: string): string[] {
  return value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
}

export function App() {
  const [password, setPassword] = useState(getAdminPassword());
  const [view, setView] = useState<View>("mailboxes");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState("");
  const [mails, setMails] = useState<MailSummary[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailDetail | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [suffix, setSuffix] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [clawAuth, setClawAuth] = useState<ClawAuthStatus | null>(null);
  const [clawLoginEmail, setClawLoginEmail] = useState("");
  const [clawLoginCode, setClawLoginCode] = useState("");
  const [clawCodeSent, setClawCodeSent] = useState(false);
  const [clawBusy, setClawBusy] = useState(false);

  const activeMailboxes = useMemo(
    () => mailboxes.filter((mailbox) => mailbox.status !== "deleted"),
    [mailboxes]
  );

  async function loadMailboxes(sync = false) {
    setError("");
    const items = await fetchMailboxes(sync);
    setMailboxes(items);
    if (!selectedMailbox && items[0]) {
      setSelectedMailbox(items[0].email);
    }
  }

  async function loadClawAuthStatus() {
    const data = await fetchClawAuthStatus();
    setClawAuth(data);
  }

  async function loadMails(mailbox = selectedMailbox) {
    if (!mailbox) return;
    setError("");
    const data = await fetchMails(mailbox);
    setMails(data.items);
  }

  async function loadMail(id: number) {
    setError("");
    const detail = await fetchMail(id);
    setSelectedMail(detail);
    setReplyBody("");
  }

  useEffect(() => {
    if (!password) return;
    setAdminPassword(password);
    loadClawAuthStatus().catch((err) => setError(err.message));
    loadMailboxes().catch((err) => setError(err.message));
  }, [password]);

  useEffect(() => {
    if (!password) return;
    const events = createEventSource();
    events.addEventListener("mail", () => {
      loadMails().catch((err) => setError(err.message));
    });
    events.onerror = () => {
      setStatus("实时连接断开，稍后会自动重连");
    };
    return () => events.close();
  }, [password, selectedMailbox]);

  useEffect(() => {
    if (!selectedMailbox) return;
    loadMails(selectedMailbox).catch((err) => setError(err.message));
  }, [selectedMailbox]);

  async function handleCreateMailbox() {
    setStatus("");
    setError("");
    try {
      const created = await createMailbox(suffix);
      setSuffix("");
      setStatus(`已创建 ${created.email}`);
      await loadMailboxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendClawCode() {
    setStatus("");
    setError("");
    setClawBusy(true);
    try {
      await sendClawLoginCode(clawLoginEmail.trim());
      setClawCodeSent(true);
      setStatus("验证码已发送");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClawBusy(false);
    }
  }

  async function handleVerifyClawCode() {
    setStatus("");
    setError("");
    setClawBusy(true);
    try {
      const result = await verifyClawLoginCode(clawLoginEmail.trim(), clawLoginCode.trim());
      setClawAuth(result.auth);
      setClawLoginCode("");
      setStatus(`Claw 已连接，同步 ${result.syncedMailboxes} 个邮箱`);
      await loadMailboxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClawBusy(false);
    }
  }

  async function handleRefreshClaw() {
    setStatus("");
    setError("");
    setClawBusy(true);
    try {
      const result = await refreshClawConnection();
      setClawAuth(result.auth);
      setStatus(`连接已刷新，同步 ${result.syncedMailboxes} 个邮箱`);
      await loadMailboxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClawBusy(false);
    }
  }

  async function handleDisconnectClaw() {
    if (!confirm("确认断开 Claw 连接？")) return;
    setStatus("");
    setError("");
    setClawBusy(true);
    try {
      const result = await disconnectClaw();
      setClawAuth(result);
      setStatus("Claw 连接已断开");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClawBusy(false);
    }
  }

  async function handleDeleteMailbox(mailbox: Mailbox) {
    if (!confirm(`确认删除 ${mailbox.email}？`)) return;
    setStatus("");
    setError("");
    try {
      await deleteMailbox(mailbox.id);
      setStatus(`已删除 ${mailbox.email}`);
      await loadMailboxes();
      if (selectedMailbox === mailbox.email) {
        setSelectedMailbox("");
        setMails([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function isPrimaryMailbox(mailbox: Mailbox): boolean {
    if (!clawAuth) return false;
    return mailbox.id === clawAuth.parentMailboxId ||
      mailbox.email === `${clawAuth.rootPrefix}@${clawAuth.domain}`;
  }

  async function handleSend() {
    setStatus("");
    setError("");
    try {
      await sendMail({
        from: selectedMailbox,
        to: splitRecipients(sendTo),
        subject: sendSubject,
        body: sendBody
      });
      setSendOpen(false);
      setSendTo("");
      setSendSubject("");
      setSendBody("");
      setStatus("邮件已发送");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReply() {
    if (!selectedMail) return;
    setStatus("");
    setError("");
    try {
      await replyMail({ mailId: selectedMail.id, body: replyBody });
      setReplyBody("");
      setStatus("回复已发送");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!password) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <h1>Claw Email Manager</h1>
          <p>输入后端管理密码后开始管理邮箱。</p>
          <input
            type="password"
            placeholder="ADMIN_PASSWORD"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPassword((event.currentTarget as HTMLInputElement).value);
              }
            }}
          />
          <button onClick={() => {
            const input = document.querySelector<HTMLInputElement>(".login-panel input");
            setPassword(input?.value ?? "");
          }}>进入</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">CE</span>
          <div>
            <strong>Claw Email</strong>
            <small>Mailbox Control</small>
          </div>
        </div>
        <nav>
          <button className={view === "mailboxes" ? "active" : ""} onClick={() => setView("mailboxes")}>邮箱管理</button>
          <button className={view === "inbox" ? "active" : ""} onClick={() => setView("inbox")}>收件箱</button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => {
            setAdminPassword("");
            setPassword("");
          }}>退出</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{view === "mailboxes" ? "邮箱管理" : "收件箱"}</h1>
            <p>{view === "mailboxes" ? "创建和删除 Claw 子邮箱" : "查看新邮件、发送和回复"}</p>
          </div>
          <div className="topbar-actions">
            <select value={selectedMailbox} onChange={(event) => setSelectedMailbox(event.target.value)}>
              <option value="">选择邮箱</option>
              {activeMailboxes.map((mailbox) => (
                <option key={mailbox.id} value={mailbox.email}>{mailbox.email}</option>
              ))}
            </select>
            <button onClick={() => setSendOpen(true)} disabled={!selectedMailbox || !clawAuth?.hasApiKey}>写信</button>
            <button onClick={() => loadMailboxes(true).catch((err) => setError(err.message))} disabled={!clawAuth?.hasDashboardCookie}>同步</button>
          </div>
        </header>

        {status && <div className="notice">{status}</div>}
        {error && <div className="error">{error}</div>}

        <section className={`connection-panel ${clawAuth?.connected ? "connected" : ""}`}>
          <div>
            <strong>{clawAuth?.connected ? "Claw 已连接" : "连接 Claw"}</strong>
            <small>
              {clawAuth?.connected
                ? `${clawAuth.userEmail ?? "Claw account"} · ${clawAuth.workspaceName ?? clawAuth.workspaceId}`
                : "使用 Claw 邮箱验证码自动获取 Cookie 和 API Key"}
            </small>
          </div>
          {clawAuth?.connected ? (
            <div className="connection-actions">
              <span className="mono">
                {clawAuth.apiKeyPrefix}***{clawAuth.apiKeySuffix}
              </span>
              <span>{clawAuth.rootPrefix}@{clawAuth.domain}</span>
              <button onClick={handleRefreshClaw} disabled={clawBusy}>刷新连接</button>
              <button className="danger" onClick={handleDisconnectClaw} disabled={clawBusy}>断开</button>
            </div>
          ) : (
            <div className="connection-form">
              <input
                type="email"
                value={clawLoginEmail}
                onChange={(event) => setClawLoginEmail(event.target.value)}
                placeholder="Claw 登录邮箱"
              />
              {clawCodeSent && (
                <input
                  value={clawLoginCode}
                  onChange={(event) => setClawLoginCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="验证码"
                />
              )}
              <button onClick={handleSendClawCode} disabled={clawBusy || !clawLoginEmail}>发送验证码</button>
              <button onClick={handleVerifyClawCode} disabled={clawBusy || !clawCodeSent || !clawLoginCode}>连接</button>
            </div>
          )}
        </section>

        {view === "mailboxes" && (
          <section className="panel">
            <div className="create-row">
              <span>{clawAuth?.rootPrefix ?? "vercel"}.</span>
              <input
                value={suffix}
                onChange={(event) => setSuffix(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                placeholder="4"
              />
              <span>@{clawAuth?.domain ?? "claw.163.com"}</span>
              <button onClick={handleCreateMailbox} disabled={!suffix || !clawAuth?.hasDashboardCookie}>创建邮箱</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>邮箱</th>
                  <th>状态</th>
                  <th>Auth URL</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {activeMailboxes.map((mailbox) => (
                  <tr key={mailbox.id}>
                    <td>{mailbox.email}</td>
                    <td>{mailbox.status}</td>
                    <td className="mono">{mailbox.auth_url ?? "-"}</td>
                    <td>{mailbox.created_at}</td>
                    <td>
                      <button onClick={() => {
                        setSelectedMailbox(mailbox.email);
                        setView("inbox");
                      }}>打开</button>
                      <button
                        className="danger"
                        onClick={() => handleDeleteMailbox(mailbox)}
                        disabled={isPrimaryMailbox(mailbox)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {view === "inbox" && (
          <section className="inbox-layout">
            <div className="mail-list">
              <div className="section-title">
                <strong>{selectedMailbox || "未选择邮箱"}</strong>
                <button onClick={() => loadMails().catch((err) => setError(err.message))} disabled={!selectedMailbox}>刷新</button>
              </div>
              {mails.map((mail) => (
                <button
                  key={mail.id}
                  className={`mail-row ${selectedMail?.id === mail.id ? "selected" : ""}`}
                  onClick={() => loadMail(mail.id).catch((err) => setError(err.message))}
                >
                  <span>{mail.subject || "(无主题)"}</span>
                  <small>{mail.source || "unknown sender"}</small>
                </button>
              ))}
              {mails.length === 0 && <div className="empty">暂无邮件</div>}
            </div>

            <article className="mail-detail">
              {!selectedMail && <div className="empty">选择左侧邮件查看详情</div>}
              {selectedMail && (
                <>
                  <h2>{selectedMail.subject || "(无主题)"}</h2>
                  <dl>
                    <dt>From</dt>
                    <dd>{selectedMail.source || "-"}</dd>
                    <dt>To</dt>
                    <dd>{selectedMail.address || selectedMail.mailbox_email}</dd>
                    <dt>Time</dt>
                    <dd>{selectedMail.received_at || selectedMail.created_at}</dd>
                  </dl>
                  <div className="body-view">
                    {selectedMail.html ? (
                      <iframe title="mail-html" srcDoc={selectedMail.html} />
                    ) : (
                      <pre>{selectedMail.text || ""}</pre>
                    )}
                  </div>
                  {selectedMail.attachments.length > 0 && (
                    <div className="attachments">
                      <strong>附件</strong>
                      {selectedMail.attachments.map((item) => (
                        <a
                          key={item.id}
                          href={`/api/mails/${selectedMail.id}/attachments/${encodeURIComponent(item.provider_part_id)}?token=${encodeURIComponent(password)}`}
                        >
                          {item.filename || item.provider_part_id}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="reply-box">
                    <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="回复内容" />
                    <button onClick={handleReply} disabled={!replyBody}>回复</button>
                  </div>
                </>
              )}
            </article>
          </section>
        )}
      </section>

      {sendOpen && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>发送邮件</h2>
            <label>发件邮箱<input value={selectedMailbox} readOnly /></label>
            <label>收件人<textarea value={sendTo} onChange={(event) => setSendTo(event.target.value)} placeholder="a@example.com, b@example.com" /></label>
            <label>主题<input value={sendSubject} onChange={(event) => setSendSubject(event.target.value)} /></label>
            <label>正文<textarea value={sendBody} onChange={(event) => setSendBody(event.target.value)} /></label>
            <div className="modal-actions">
              <button onClick={handleSend} disabled={!selectedMailbox || splitRecipients(sendTo).length === 0}>发送</button>
              <button onClick={() => setSendOpen(false)}>取消</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

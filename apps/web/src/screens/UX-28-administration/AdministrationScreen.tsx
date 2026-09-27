import { useState } from "react";
import {
  addRole,
  confirmAdminDestructiveAction,
  impersonationAuditActor,
  isAdminActionAvailable,
  nextReferenceDataVersion,
  removeRole,
  requestImpersonation,
  visibleAdminSections,
  type AdminDestructiveAction,
  type ImpersonationConsent,
  type OrgRole,
} from "./administrationForm";

/**
 * TASK-0091: `ux-specification.md UX-28` -- Administration, MVP subset.
 * Styling not applied, same scope boundary as every earlier screen this
 * session. Player-registry merge, competition/template config, branding,
 * and dispute adjudication are deliberately absent -- deferred per the
 * backlog's own `§6.3` tracking entry.
 */

export interface AdminMember {
  id: string;
  name: string;
  roles: OrgRole[];
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
}

export interface ActiveImpersonation {
  targetUserId: string;
  targetName: string;
}

export interface AdministrationScreenProps {
  isOrgAdmin: boolean;
  isPlatformAdmin: boolean;
  activeImpersonation: ActiveImpersonation | null;
  onEndImpersonation: () => void;
  members: AdminMember[];
  onInviteMember: (email: string, role: OrgRole) => void;
  onChangeRoles: (memberId: string, roles: OrgRole[]) => void;
  onDeactivateMember: (memberId: string) => void;
  featureFlags: FeatureFlag[];
  onToggleFeatureFlag: (key: string) => void;
  referenceDataVersions: string[];
  onPublishReferenceData: (newVersionId: string) => void;
  impersonationConsents: Record<string, ImpersonationConsent | null>;
  onStartImpersonation: (userId: string, auditActor: string) => void;
  currentAdminId: string;
  now: string;
  isOffline: boolean;
}

export function AdministrationScreen({
  isOrgAdmin,
  isPlatformAdmin,
  activeImpersonation,
  onEndImpersonation,
  members,
  onInviteMember,
  onChangeRoles,
  onDeactivateMember,
  featureFlags,
  onToggleFeatureFlag,
  referenceDataVersions,
  onPublishReferenceData,
  impersonationConsents,
  onStartImpersonation,
  currentAdminId,
  now,
  isOffline,
}: AdministrationScreenProps) {
  const sections = visibleAdminSections(isOrgAdmin, isPlatformAdmin);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("VIEWER");
  const [pendingConfirm, setPendingConfirm] = useState<{ action: AdminDestructiveAction; memberId: string; role?: OrgRole } | null>(null);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  const writeDisabled = !isAdminActionAvailable("WRITE", isOffline);

  function handleConfirm() {
    if (!pendingConfirm) return;
    const result = confirmAdminDestructiveAction(pendingConfirm.action, true);
    if (result.outcome === "confirmed") {
      if (pendingConfirm.action === "DEACTIVATE_MEMBER") {
        onDeactivateMember(pendingConfirm.memberId);
      } else if (pendingConfirm.role) {
        const member = members.find((m) => m.id === pendingConfirm.memberId);
        if (member) onChangeRoles(member.id, removeRole(member.roles, pendingConfirm.role));
      }
    }
    setPendingConfirm(null);
  }

  function handleAddRole(member: AdminMember, role: OrgRole) {
    onChangeRoles(member.id, addRole(member.roles, role));
  }

  function handleImpersonate(userId: string) {
    const consent = impersonationConsents[userId] ?? null;
    const result = requestImpersonation(consent, now);
    if (result.outcome === "refused") {
      setImpersonationError(result.reason);
      return;
    }
    setImpersonationError(null);
    onStartImpersonation(userId, impersonationAuditActor(currentAdminId, userId));
  }

  function handlePublishReferenceData() {
    onPublishReferenceData(nextReferenceDataVersion(referenceDataVersions));
  }

  return (
    <div>
      {activeImpersonation && (
        <div role="status" aria-label="Active impersonation">
          <p>Impersonating {activeImpersonation.targetName}</p>
          <button type="button" onClick={onEndImpersonation}>
            End impersonation
          </button>
        </div>
      )}

      {isOffline && <p role="status">Offline — administrative changes are disabled until you reconnect</p>}

      {sections.includes("MEMBERS") && (
        <section aria-labelledby="section-members">
          <h2 id="section-members">Members</h2>

          <label htmlFor="invite-email">Invite email</label>
          <input id="invite-email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={writeDisabled} />
          <label htmlFor="invite-role">Role</label>
          <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} disabled={writeDisabled}>
            <option value="VIEWER">Viewer</option>
            <option value="HEAD_SCORER">Head Scorer</option>
            <option value="CAPTAIN">Captain</option>
          </select>
          <button type="button" onClick={() => onInviteMember(inviteEmail, inviteRole)} disabled={writeDisabled}>
            Send invite
          </button>

          {members.length === 0 ? (
            <p>No members yet</p>
          ) : (
            <ul aria-label="Members">
              {members.map((member) => (
                <li key={member.id}>
                  <span>{member.name}</span>
                  <span>{member.roles.join(", ")}</span>
                  <button type="button" onClick={() => handleAddRole(member, "HEAD_SCORER")} disabled={writeDisabled}>
                    Grant Head Scorer
                  </button>
                  {member.roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setPendingConfirm({ action: "REVOKE_ROLE", memberId: member.id, role })}
                      disabled={writeDisabled}
                    >
                      Revoke {role}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPendingConfirm({ action: "DEACTIVATE_MEMBER", memberId: member.id })}
                    disabled={writeDisabled}
                  >
                    Deactivate
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sections.includes("FEATURE_FLAGS") && (
        <section aria-labelledby="section-flags">
          <h2 id="section-flags">Feature flags</h2>
          <ul aria-label="Feature flags">
            {featureFlags.map((flag) => (
              <li key={flag.key}>
                <label>
                  <input type="checkbox" checked={flag.enabled} onChange={() => onToggleFeatureFlag(flag.key)} disabled={writeDisabled} />
                  {flag.key}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.includes("REFERENCE_DATA") && (
        <section aria-labelledby="section-refdata">
          <h2 id="section-refdata">Reference data</h2>
          <p>Current version: {referenceDataVersions[referenceDataVersions.length - 1] ?? "none"}</p>
          <button type="button" onClick={handlePublishReferenceData} disabled={writeDisabled}>
            Publish new version
          </button>
        </section>
      )}

      {sections.includes("IMPERSONATION") && (
        <section aria-labelledby="section-impersonation">
          <h2 id="section-impersonation">Support impersonation</h2>
          {impersonationError && <p role="alert">{impersonationError}</p>}
          <ul aria-label="Impersonation targets">
            {members.map((member) => (
              <li key={member.id}>
                <button type="button" onClick={() => handleImpersonate(member.id)} disabled={writeDisabled}>
                  Impersonate {member.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingConfirm && (
        <div role="dialog" aria-label="Confirm">
          <p>
            {pendingConfirm.action === "DEACTIVATE_MEMBER"
              ? "This will deactivate this member. Are you sure?"
              : `This will revoke the ${pendingConfirm.role} role. Are you sure?`}
          </p>
          <button type="button" onClick={handleConfirm}>
            Confirm
          </button>
          <button type="button" onClick={() => setPendingConfirm(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

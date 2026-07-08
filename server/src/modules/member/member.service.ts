import type { OrgRole } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/AppError.ts";
import { memberRepository } from "./member.repository.ts";
import type { MemberResponseDto } from "./member.types.ts";

type MemberWithUser = NonNullable<Awaited<ReturnType<typeof memberRepository.findById>>>;

async function assertMutable(
  organizationId: string,
  memberId: string,
  actorRole: OrgRole,
  newRole?: OrgRole,
): Promise<MemberWithUser> {
  const member = await memberRepository.findById(memberId);
  if (!member || member.organizationId !== organizationId) {
    throw new NotFoundError("Member not found");
  }

  if (member.role === "OWNER" && actorRole !== "OWNER") {
    throw new ForbiddenError("Only an owner can modify another owner");
  }

  const isDemotingOrRemovingOwner = member.role === "OWNER" && newRole !== "OWNER";
  if (isDemotingOrRemovingOwner) {
    const ownerCount = await memberRepository.countOwners(organizationId);
    if (ownerCount <= 1) {
      throw new ConflictError("An organization must have at least one owner");
    }
  }

  return member;
}

export const memberService = {
  async listByOrg(organizationId: string): Promise<MemberResponseDto[]> {
    const members = await memberRepository.listByOrg(organizationId);
    return members.map(memberService.toResponse);
  },

  async updateRole(
    organizationId: string,
    memberId: string,
    newRole: OrgRole,
    actorRole: OrgRole,
  ): Promise<MemberResponseDto> {
    await assertMutable(organizationId, memberId, actorRole, newRole);
    const updated = await memberRepository.updateRole(memberId, newRole);
    return memberService.toResponse(updated);
  },

  async remove(organizationId: string, memberId: string, actorRole: OrgRole): Promise<void> {
    await assertMutable(organizationId, memberId, actorRole, undefined);
    await memberRepository.remove(memberId);
  },

  toResponse(member: MemberWithUser): MemberResponseDto {
    return {
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        profileImage: member.user.profileImage,
      },
    };
  },
};

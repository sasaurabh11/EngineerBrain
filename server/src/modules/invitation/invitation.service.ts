import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { OrgRole } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/AppError.ts";
import { prisma } from "../../database/prisma.ts";
import { memberRepository } from "../member/member.repository.ts";
import { invitationRepository } from "./invitation.repository.ts";
import type { CreateInvitationInput, InvitationResponseDto } from "./invitation.types.ts";

const INVITATION_TTL_DAYS = 7;

type InvitationWithInviter = NonNullable<Awaited<ReturnType<typeof invitationRepository.create>>>;

export const invitationService = {
  async listByOrg(organizationId: string): Promise<InvitationResponseDto[]> {
    const invitations = await invitationRepository.listPendingByOrg(organizationId);
    return invitations.map(invitationService.toResponse);
  },

  async create(
    organizationId: string,
    invitedById: string,
    invitedByRole: OrgRole,
    input: CreateInvitationInput,
  ): Promise<InvitationResponseDto> {
    if (input.role === "OWNER" && invitedByRole !== "OWNER") {
      throw new ForbiddenError("Only an owner can invite a new owner");
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = crypto.randomBytes(32).toString("hex");

    try {
      const invitation = await invitationRepository.create({
        email: input.email,
        organizationId,
        role: input.role,
        invitedById,
        token,
        expiresAt,
      });
      return invitationService.toResponse(invitation);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("An invitation is already pending for this email");
      }
      throw err;
    }
  },

  async revoke(organizationId: string, invitationId: string): Promise<void> {
    const invitation = await invitationRepository.findById(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundError("Invitation not found");
    }
    await invitationRepository.delete(invitationId);
  },

  async accept(token: string, currentUser: { id: string; email: string }): Promise<string> {
    const invitation = await invitationRepository.findByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    if (invitation.status !== "PENDING") {
      throw new ConflictError("This invitation is no longer valid");
    }

    if (invitation.expiresAt < new Date()) {
      await invitationRepository.updateStatus(invitation.id, "EXPIRED");
      throw new ConflictError("This invitation has expired");
    }

    if (invitation.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      throw new ForbiddenError("This invitation was sent to a different email address");
    }

    const existingMembership = await memberRepository.findByUserAndOrg(currentUser.id, invitation.organizationId);
    if (existingMembership) {
      await invitationRepository.updateStatus(invitation.id, "ACCEPTED");
      throw new ConflictError("You are already a member of this organization");
    }

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: { organizationId: invitation.organizationId, userId: currentUser.id, role: invitation.role },
      }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } }),
    ]);

    return invitation.organizationId;
  },

  toResponse(invitation: InvitationWithInviter): InvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
        email: invitation.invitedBy.email,
      },
    };
  },
};

import axios, { type AxiosError } from "axios";
import { customInstance } from "./axios-instance";
import type {
  CollectiveDetail,
  CollectiveSummary,
  MembershipDetail,
  MembershipSummary,
} from "./generated";

export function isAbortError(e: unknown): boolean {
  if (axios.isCancel(e)) return true;
  const err = e as AxiosError | undefined;
  return err?.code === "ERR_CANCELED";
}

/** Matches server `Collective.slug`: unique, URL-safe, up to 16 chars. */
const COLLECTIVE_SLUG_RE = /^[A-Za-z0-9]{1,16}$/;

export function isValidCollectiveSlug(s: string | undefined): boolean {
  if (s === undefined || s === "") return false;
  return COLLECTIVE_SLUG_RE.test(s);
}

export function fetchPublicCollectives(signal?: AbortSignal) {
  return customInstance<CollectiveSummary[]>({
    url: "/api/collectives/",
    method: "GET",
    signal,
  });
}

export function fetchCollective(collectiveSlug: string, signal?: AbortSignal) {
  return customInstance<CollectiveDetail>({
    url: `/api/collectives/${collectiveSlug}`,
    method: "GET",
    signal,
  });
}

export function fetchCollectiveMemberships(
  collectiveSlug: string,
  signal?: AbortSignal,
) {
  return customInstance<MembershipSummary[]>({
    url: `/api/collectives/${collectiveSlug}/members`,
    method: "GET",
    signal,
  });
}

export function fetchMembership(
  collectiveSlug: string,
  userId: number,
  signal?: AbortSignal,
) {
  return customInstance<MembershipDetail>({
    url: `/api/collectives/${collectiveSlug}/membership/${userId}`,
    method: "GET",
    signal,
  });
}

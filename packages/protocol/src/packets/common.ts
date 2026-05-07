import type { UnnamedNbtTag } from "@dripleaf/nbt";
import { DebugSubscription } from "@dripleaf/registry";
import type { Either } from "../buffer";

export enum ServerLinkType {
	BugReport = 0,
	CommunityGuidelines = 1,
	Support = 2,
	Status = 3,
	Feedback = 4,
	Community = 5,
	Website = 6,
	Forums = 7,
	News = 8,
	Announcements = 9
}

export type ServerLink = {
	label: Either<ServerLinkType, UnnamedNbtTag>;
	url: string;
}

export type DebugUpdatePayload = {
	subscription: DebugSubscription
	payload: Uint8Array
}
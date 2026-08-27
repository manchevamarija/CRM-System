import type { Language } from "../shared/types";
import { mk } from "./workspace/mk";
import { en } from "./workspace/en";
import { sq } from "./workspace/sq";

export type Copy = Record<string, string>;

const copies: Record<Language, Copy> = { mk, en, sq };

export const workspaceCopy = (language: Language): Copy => copies[language];

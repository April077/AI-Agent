import { Email } from "@/packages/db/src";
import {atom} from "recoil";


export const emailState = atom<Email[]>({
  key: "emailState",
  default: [],
});
import {fireEvent,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {expect,it} from "vitest";
import {setupPanel} from "./overview-record-panel.test-support";

it("starts from the confirmed text and saves a new value only on Enter",async()=>{
 const {store,save}=setupPanel();const field=screen.getByRole("textbox",{name:"Record text"});
 expect(store.isDirty()).toBe(false);await userEvent.clear(field);await userEvent.type(field,"Edited text{Enter}");
 expect(save).toHaveBeenCalledOnce();expect(store.getSnapshot().text).toBe("Edited text");
});
it("keeps Shift+Enter and composition Enter out of the save path",async()=>{
 const {store,save}=setupPanel();const field=screen.getByRole("textbox",{name:"Record text"});
 await userEvent.type(field,"{Shift>}{Enter}{/Shift}second line");
 expect(store.getSnapshot().text).toContain("\nsecond line");
 fireEvent.keyDown(field,{key:"Enter",isComposing:true});expect(save).not.toHaveBeenCalled();
});
it("refuses a blank commit and keeps the input available",async()=>{
 const {save}=setupPanel();const field=screen.getByRole("textbox",{name:"Record text"});
 await userEvent.clear(field);await userEvent.type(field," {Enter}");
 expect(screen.getByRole("alert")).toHaveTextContent("The text can’t be empty");
 expect(save).not.toHaveBeenCalled();expect(field).toBeVisible();
});
it("preserves typed text after Escape and Keep editing",async()=>{
 const {save,close}=setupPanel();const field=screen.getByRole("textbox",{name:"Record text"});
 await userEvent.type(field," changed{Escape}");
 const alert=screen.getByRole("alertdialog",{name:"Discard changes?"});
 await userEvent.click(within(alert).getByRole("button",{name:"Keep editing"}));
 expect(field).toHaveValue("Original text changed");expect(close).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
});
it("closes an unchanged panel with Cancel without submitting",async()=>{
 const {save,close}=setupPanel();await userEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(close).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();
});

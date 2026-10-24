import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Modal } from './components';

describe('shared accessible controls', () => {
  it('keeps keyboard focus inside the top dialog and ignores hidden or disabled controls', async () => {
    const user = userEvent.setup();
    render(<Modal title="Keyboard test" onClose={vi.fn()}><button hidden>Hidden</button><div style={{display:'none'}}><button>Hidden ancestor</button></div><button disabled>Disabled</button><button>Last action</button></Modal>);
    const close = screen.getByRole('button', {name:'Close'}), last = screen.getByRole('button', {name:'Last action'});
    expect(close).toHaveFocus();
    await user.tab({shift:true}); expect(last).toHaveFocus();
    await user.tab(); expect(close).toHaveFocus();
    await user.tab(); expect(last).toHaveFocus();
    expect(close).toHaveAttribute('type','button');
  });
  it('keeps body scrolling locked when a parent closes before its nested confirmation', () => {
    document.body.style.overflow = 'auto';
    const keep = vi.fn(), close = vi.fn();
    const ui = (parent:boolean, child:boolean) => <>{parent && <Modal title="Parent" onClose={close}><button>Parent action</button></Modal>}{child && <Modal title="Confirmation" onClose={keep}><button>Keep editing</button></Modal>}</>;
    const view = render(ui(true,true));
    expect(document.body.style.overflow).toBe('hidden');
    view.rerender(ui(false,true)); expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, {key:'Escape'}); expect(keep).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
    view.rerender(ui(false,false)); expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
  it('restores the trigger and retains the underlying form when dismissing a confirmation', async () => {
    const user = userEvent.setup();
    function Example(){const [open,setOpen]=useState(false),[confirm,setConfirm]=useState(false);return <><button onClick={()=>setOpen(true)}>Edit record</button>{open&&<Modal title="Edit" onClose={()=>setConfirm(true)}><label>Clinical note<input defaultValue="Retained draft"/></label><button onClick={()=>setConfirm(true)}>Cancel</button></Modal>}{confirm&&<Modal title="Discard?" onClose={()=>setConfirm(false)}><button onClick={()=>setConfirm(false)}>Keep editing</button><button onClick={()=>{setConfirm(false);setOpen(false)}}>Discard</button></Modal>}</>}
    render(<Example/>);await user.click(screen.getByRole('button',{name:'Edit record'}));await user.click(screen.getByRole('button',{name:'Cancel'}));await user.keyboard('{Escape}');expect(screen.getByLabelText('Clinical note')).toHaveValue('Retained draft');await user.click(screen.getByRole('button',{name:'Cancel'}));await user.click(within(screen.getByRole('dialog',{name:'Discard?'})).getByRole('button',{name:'Discard'}));expect(screen.getByRole('button',{name:'Edit record'})).toHaveFocus();expect(document.body.style.overflow).toBe('');
  });
  it('gives operational states semantic tones without removing their meaningful labels', () => {
    render(<>{['Completed','Draft','Awaiting Review','Overdue','Under Maintenance','Demo Simulation'].map(s=><Badge key={s}>{s}</Badge>)}</>);
    for(const [label,tone] of [['Completed','success'],['Draft','neutral'],['Awaiting Review','warning'],['Overdue','danger'],['Under Maintenance','danger'],['Demo Simulation','info']])expect(screen.getByText(label)).toHaveAttribute('data-tone',tone);
  });
});

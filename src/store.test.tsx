import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClinicProvider, useClinic } from './store';
import { readState } from './data';
describe('accepted demo changes',()=>{
 it('persists before a save handler closes its form and composes consecutive updates',()=>{
  let persisted='',firstName='';
  function Form(){const{state,setState}=useClinic();return <button onClick={()=>{setState(s=>({...s,clinicName:'Immediately saved clinic'}));firstName=readState().clinicName;setState(s=>({...s,clinicName:s.clinicName+' v2'}));persisted=readState().clinicName;}}>Save {state.clinicName}</button>}
  render(<ClinicProvider><Form/></ClinicProvider>);fireEvent.click(screen.getByRole('button'));
  expect(firstName).toBe('Immediately saved clinic');expect(persisted).toBe('Immediately saved clinic v2');expect(screen.getByRole('button')).toHaveTextContent('v2');
 });
});

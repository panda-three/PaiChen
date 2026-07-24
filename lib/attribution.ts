export function lastValidAttribution(input: { employeeId: string | null; employeeActive: boolean; sameStore: boolean; authenticatedAction: boolean }) {
  return input.employeeId && input.employeeActive && input.sameStore && input.authenticatedAction ? input.employeeId : null;
}

import { useEffect, useState } from 'react'
import { employeesApi, type EmployeeProfile } from './index'

export function NailistsShowcase({ onSelect }: { onSelect?: (employee: EmployeeProfile) => void }) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  useEffect(() => { void employeesApi.public().then(({ data }) => setEmployees(data)) }, [])
  return <section><h2>Meet our nail artists</h2><div className="grid">{employees.map((employee) => <button className="card selectable" key={employee.id} onClick={() => onSelect?.(employee)}>{employee.avatarUrl && <img className="avatar" src={employee.avatarUrl} alt="" />}<strong>{employee.displayName}</strong><span>{employee.roleTitle}</span><small>{employee.bio}</small><small>{employee.skillTags.join(' · ')}</small></button>)}</div></section>
}

export const NailistPicker = NailistsShowcase

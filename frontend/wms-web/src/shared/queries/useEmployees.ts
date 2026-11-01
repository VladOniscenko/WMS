import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, type EmployeeProfile } from '@modules/employees'

export const employeeKeys = {
  all: ['employees'] as const,
  detail: (id: string) => ['employees', id] as const,
}

export function useEmployees() {
  return useQuery({
    queryKey: employeeKeys.all,
    queryFn: async () => {
      const { data } = await employeesApi.list()
      return data
    },
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      displayName: string
      email: string
      roleTitle: string
      bio?: string
      assignedWebsiteIds: string[]
      skillTags: string[]
      isActive: boolean
    }) => {
      const { data } = await employeesApi.create(payload)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all })
    },
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeProfile> }) => {
      const response = await employeesApi.update(id, data)
      return response.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all })
    },
  })
}

export function useUpdateEmployeeSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      schedule,
    }: {
      id: string
      schedule: { weeklyWindows: { day: number; startTime: string; endTime: string }[] }
    }) => {
      const response = await employeesApi.updateSchedule(id, schedule)
      return response.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all })
    },
  })
}


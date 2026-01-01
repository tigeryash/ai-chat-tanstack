import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(dashboard)/$chatId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(dashboard)/chatId"!</div>
}

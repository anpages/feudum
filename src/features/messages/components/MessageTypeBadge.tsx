import { Sword, Eye, User, Compass } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export function MessageTypeBadge({ type }: { type: string }) {
  if (type === 'battle')
    return (
      <Badge variant="crimson">
        <Sword size={9} className="mr-0.5" />
        Batalla
      </Badge>
    )
  if (type === 'spy')
    return (
      <Badge variant="stone">
        <Eye size={9} className="mr-0.5" />
        Espionaje
      </Badge>
    )
  if (type === 'player')
    return (
      <Badge variant="gold">
        <User size={9} className="mr-0.5" />
        Mensaje
      </Badge>
    )
  if (type === 'expedition')
    return (
      <Badge variant="forest">
        <Compass size={9} className="mr-0.5" />
        Expedición
      </Badge>
    )
  return <Badge variant="gold">Sistema</Badge>
}

import {useEffect, useRef, useState} from 'react'
import {BackHandler, Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ArrowUUpLeft} from '#/components/icons/ArrowUUpLeft'
import {ArrowUUpRight} from '#/components/icons/ArrowUUpRight'
import {type Props as IconProps} from '#/components/icons/common'
import {Eraser} from '#/components/icons/Eraser'
import {Eyedropper} from '#/components/icons/Eyedropper'
import {Hand} from '#/components/icons/Hand'
import {PaintBucket} from '#/components/icons/PaintBucket'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Toast from '#/components/Toast'
import {IS_WEB} from '#/env'
import {
  BrushSizePopover,
  ColorPopover,
} from '#/features/halloween/costumes/ColorPopover'
import {DrawingSurface} from '#/features/halloween/costumes/DrawingSurface'
import {isEmpty} from '#/features/halloween/costumes/model'
import {PixelLayer} from '#/features/halloween/costumes/PixelLayer'
import {ToolHint} from '#/features/halloween/costumes/ToolHint'
import {type useDrawing} from '#/features/halloween/costumes/useDrawing'

export function CostumeWorkspace({
  drawing,
  avatar,
  recentColors = [],
  active = true,
  disabled,
  onClear,
}: {
  drawing: ReturnType<typeof useDrawing>
  avatar?: string
  recentColors?: string[]
  active?: boolean
  disabled: boolean
  onClear: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const root = useRef<React.ComponentRef<typeof View>>(null)
  const colorAnchor = useRef<React.ComponentRef<typeof View>>(null)
  const sizeAnchor = useRef<React.ComponentRef<typeof View>>(null)
  const colorTrigger = useRef<React.ComponentRef<typeof View>>(null)
  const sizeTrigger = useRef<React.ComponentRef<typeof View>>(null)
  const [bounds, setBounds] = useState({width: 320, height: 700})
  const [popover, setPopover] = useState<'color' | 'size' | null>(null)
  const [anchorCenter, setAnchorCenter] = useState(160)
  const close = () => setPopover(null)
  const dismiss = () => {
    setPopover(null)
    if (IS_WEB)
      (popover === 'color' ? colorTrigger : sizeTrigger).current?.focus()
  }
  useEffect(() => {
    if (!active) {
      close()
      return
    }
    if (!popover) return
    if (IS_WEB) {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          dismiss()
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      return () => window.removeEventListener('keydown', onKeyDown, true)
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismiss()
        return true
      },
    )
    return () => subscription.remove()
  }, [popover, active])
  const open = (kind: 'color' | 'size') => {
    setPopover(previous => (previous === kind ? null : kind))
    const anchor = kind === 'color' ? colorAnchor : sizeAnchor
    setAnchorCenter(bounds.width / 2)
    anchor.current?.measureInWindow((x, _y, width) =>
      root.current?.measureInWindow(rootX =>
        setAnchorCenter(x - rootX + width / 2),
      ),
    )
  }
  const size = Math.max(
    64,
    Math.floor(Math.min(512, bounds.width - 24, bounds.height - 152)),
  )
  const panelWidth = Math.min(
    popover === 'size' ? 208 : 280,
    Math.max(160, bounds.width - 16),
  )
  const maxHeight = Math.min(460, Math.max(160, bounds.height - 88))
  const left = Math.max(
    8,
    Math.min(bounds.width - panelWidth - 8, anchorCenter - panelWidth / 2),
  )
  const tools = [
    {id: 'brush', label: l`Brush`, icon: PencilIcon},
    {id: 'eraser', label: l`Eraser`, icon: Eraser},
    {id: 'fill', label: l`Fill drawing area`, icon: PaintBucket},
    {
      id: 'eyedropper',
      label: l`Pick a color from the canvas`,
      icon: Eyedropper,
    },
    {id: 'pan', label: l`Move canvas`, icon: Hand},
  ] as const

  return (
    <View
      ref={root}
      style={[a.flex_1, a.relative]}
      onLayout={event =>
        setBounds({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }>
      <View
        style={[
          a.absolute,
          a.align_center,
          a.justify_center,
          {left: 8, right: 8, top: 72, bottom: 72},
        ]}>
        <View style={[a.overflow_hidden, a.rounded_sm, t.atoms.bg_contrast_25]}>
          <DrawingSurface
            size={size}
            gestures
            pan={drawing.tool === 'pan'}
            disabled={disabled || !active || popover !== null}
            cursorSize={
              drawing.tool === 'fill' || drawing.tool === 'eyedropper'
                ? 1
                : drawing.brushSize
            }
            label={l`Pixel costume canvas`}
            hint={l`Drag to draw. Pinch with two fingers to zoom and move. Tap with two fingers to undo, or three to redo. Use plus, minus, and zero for keyboard zoom.`}
            onStart={drawing.start}
            onMove={drawing.move}
            onEnd={drawing.end}
            onCancel={drawing.cancel}
            onUndo={drawing.undo}
            onRedo={drawing.redo}>
            <View
              style={[
                a.overflow_hidden,
                {width: size, height: size, borderRadius: size / 2},
              ]}>
              <UserAvatar type="user" avatar={avatar} size={size} noBorder />
              <PixelLayer costume={drawing.costume} size={size} />
            </View>
          </DrawingSurface>
        </View>
      </View>
      {popover && (
        <Pressable
          testID="costumePopoverBackdrop"
          accessibilityRole="button"
          accessibilityLabel={l`Close tool options`}
          accessibilityHint={l`Return to the canvas without drawing`}
          style={[a.absolute, a.inset_0]}
          onPress={dismiss}
        />
      )}
      <View
        pointerEvents="box-none"
        style={[a.absolute, a.align_center, {left: 8, right: 8, top: 8}]}>
        <Toolbar testID="costumeToolsBar">
          {tools.map(tool => (
            <ToolButton
              key={tool.id}
              testID={`costumeTool-${tool.id}`}
              label={tool.label}
              icon={tool.icon}
              selected={drawing.tool === tool.id}
              disabled={disabled}
              onPress={() => {
                drawing.setTool(tool.id)
                close()
              }}
            />
          ))}
        </Toolbar>
      </View>
      <View
        pointerEvents="box-none"
        style={[a.absolute, a.align_center, {left: 8, right: 8, bottom: 8}]}>
        <Toolbar testID="costumeActionsBar">
          <View ref={sizeAnchor} collapsable={false}>
            <ToolHint label={l`Brush size: ${drawing.brushSize} pixels`}>
              <Button
                ref={sizeTrigger}
                testID="costumeBrushSize"
                label={l`Brush size: ${drawing.brushSize} pixels`}
                accessibilityState={{expanded: popover === 'size'}}
                size="small"
                shape="square"
                color={popover === 'size' ? 'primary_subtle' : 'secondary'}
                style={{width: 44, height: 44}}
                disabled={disabled}
                onPress={() => open('size')}>
                <ButtonText style={[a.text_xs]}>
                  {drawing.brushSize} px
                </ButtonText>
              </Button>
            </ToolHint>
          </View>
          <View ref={colorAnchor} collapsable={false}>
            <ToolHint label={l`Drawing color`}>
              <Button
                ref={colorTrigger}
                testID="costumeColor"
                label={l`Drawing color`}
                accessibilityState={{expanded: popover === 'color'}}
                size="small"
                shape="square"
                color={popover === 'color' ? 'primary_subtle' : 'secondary'}
                style={{width: 44, height: 44}}
                disabled={disabled}
                onPress={() => open('color')}>
                <View
                  style={[
                    a.rounded_full,
                    {
                      width: 28,
                      height: 28,
                      backgroundColor: drawing.color,
                      borderWidth: 2,
                      borderColor: t.palette.contrast_500,
                    },
                  ]}
                />
              </Button>
            </ToolHint>
          </View>
          <Divider />
          <ToolButton
            testID="costumeUndo"
            label={l`Undo`}
            icon={ArrowUUpLeft}
            disabled={disabled || !drawing.canUndo}
            onPress={drawing.undo}
          />
          <ToolButton
            testID="costumeRedo"
            label={l`Redo`}
            icon={ArrowUUpRight}
            disabled={disabled || !drawing.canRedo}
            onPress={drawing.redo}
          />
          <Divider />
          <ToolButton
            testID="costumeClear"
            label={l`Clear drawing`}
            icon={TrashIcon}
            disabled={disabled || isEmpty(drawing.costume)}
            onPress={() => {
              close()
              onClear()
            }}
          />
        </Toolbar>
      </View>
      {popover && (
        <View style={[a.absolute, {left, bottom: 72}]}>
          {popover === 'color' ? (
            <ColorPopover
              color={drawing.color}
              recent={recentColors}
              width={panelWidth}
              maxHeight={maxHeight}
              onChange={drawing.selectColor}
              onClose={dismiss}
            />
          ) : (
            <BrushSizePopover
              size={drawing.brushSize}
              width={panelWidth}
              maxHeight={maxHeight}
              onChange={drawing.setBrushSize}
              onClose={dismiss}
            />
          )}
        </View>
      )}
    </View>
  )
}

function Toolbar({
  testID,
  children,
}: {
  testID: string
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.p_xs,
        a.gap_xs,
        a.rounded_md,
        a.border,
        t.atoms.bg,
        t.atoms.border_contrast_low,
      ]}>
      {children}
    </View>
  )
}

function Divider() {
  const t = useTheme()
  return (
    <View
      style={[a.border_l, a.mx_xs, t.atoms.border_contrast_low, {height: 24}]}
    />
  )
}

function ToolButton({
  testID,
  label,
  icon,
  selected = false,
  disabled = false,
  onPress,
}: {
  testID: string
  label: string
  icon: React.ComponentType<IconProps>
  selected?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <ToolHint label={label}>
      <Button
        testID={testID}
        label={label}
        accessibilityState={{selected}}
        size="small"
        shape="square"
        color={selected ? 'primary_subtle' : 'secondary'}
        style={{width: 44, height: 44}}
        disabled={disabled}
        onPress={onPress}
        onLongPress={() => Toast.show(label)}>
        <ButtonIcon icon={icon} />
      </Button>
    </ToolHint>
  )
}

<template>
  <el-config-provider :locale="zhCn">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const { appName, appTitle, version } = useAppBrand()

useHead({
  title: () => appTitle.value,
  meta: [
    { name: 'description', content: () => `${appName.value} ${version}` },
  ],
})
</script>

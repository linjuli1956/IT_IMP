<script setup>
const initialAdmin = defineModel({
  type: Object,
  required: true,
})
</script>

<template>
  <el-divider content-position="left">首次管理员</el-divider>
  <el-form-item label="管理员账号">
    <el-input v-model="initialAdmin.username" autocomplete="username" placeholder="admin" />
  </el-form-item>
  <el-form-item label="初始密码">
    <el-input
      v-model="initialAdmin.password"
      type="password"
      show-password
      autocomplete="new-password"
      placeholder="至少 6 位"
    />
    <el-text type="info" size="small">
      仅在点击“初始化数据库”或“重置管理员密码”时使用，不保存到配置文件；默认账号为 admin，默认密码为 123456。
    </el-text>
  </el-form-item>
</template>

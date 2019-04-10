import { CloudWatchLogsLogEvent } from 'aws-lambda'
import { connect } from 'net'
import { groupBy, keys } from 'lodash'

import { parseAll } from './parse'
import cloudwatch from './cloudwatch'

const host = process.env.LOGSTASH_HOST
const port = Number(process.env.LOGSTASH_PORT)
const token = process.env.LOGSTASH_TOKEN

const sendLogs = async (logs: any[]) => {
  await new Promise((resolve, reject) => {
    let socket = connect(
      port,
      host,
      function() {
        socket.setEncoding('utf8')

        for (let log of logs) {
          try {
            log.token = token
            socket.write(JSON.stringify(log) + '\n')
          } catch (err) {
            console.error(err.message)
          }
        }

        socket.end()
        resolve()
      }
    )
  })
}

let publishMetrics = async metrics => {
  let metricDatumByNamespace = groupBy(metrics, m => m.Namespace)
  let namespaces = keys(metricDatumByNamespace)
  for (let namespace of namespaces) {
    let datum = metricDatumByNamespace[namespace]

    try {
      await cloudwatch.publish(datum, namespace)
    } catch (err) {
      console.error('failed to publish metrics: ', err.message)
      console.error(JSON.stringify(datum))
    }
  }
}

export const processAll = async (
  logGroup: string,
  logStream: string,
  logEvents: CloudWatchLogsLogEvent[]
) => {
  const result = parseAll(logGroup, logStream, logEvents)

  if (result.logs) {
    await sendLogs(result.logs)
  }

  if (result.customMetrics) {
    await publishMetrics(result.customMetrics)
  }

  if (result.usageMetrics && result.usageMetrics.length > 0) {
    await publishMetrics(result.usageMetrics)
  }

}
